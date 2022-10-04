"""An integration test scenario that runs the SSH example requestor app."""
import asyncio
import logging
import os
from pathlib import Path
import pexpect
import re
import signal
import time
from typing import List

import pytest

from goth.assertions import EventStream
from goth.configuration import load_yaml, Override
from goth.runner.log import configure_logging
from goth.runner import Runner
from goth.runner.probe import RequestorProbe

logger = logging.getLogger("goth.test.run_ssh")

SUBNET_TAG = "goth"


async def assert_no_errors(output_lines: EventStream[str]):
    """Assert that no output line contains the substring `ERROR`."""
    async for line in output_lines:
        if "ERROR" in line or " error: " in line:
            raise AssertionError("Command reported ERROR")


async def assert_all_invoices_accepted(output_lines: EventStream[str]):
    """Assert that an invoice is accepted for every provider that confirmed an agreement."""
    unpaid_agreement_providers = set()

    async for line in output_lines:
        m = re.search("Agreement confirmed by provider '([^']*)'", line)
        if m:
            prov_name = m.group(1)
            logger.debug(
                "assert_all_invoices_accepted: adding provider '%s'", prov_name
            )
            unpaid_agreement_providers.add(prov_name)
        m = re.search("Accepted invoice from '([^']*)'", line)
        if m:
            prov_name = m.group(1)
            logger.debug(
                "assert_all_invoices_accepted: adding invoice for '%s'", prov_name
            )
            unpaid_agreement_providers.remove(prov_name)

    if unpaid_agreement_providers:
        raise AssertionError(
            f"Unpaid agreements for: {','.join(unpaid_agreement_providers)}"
        )


@pytest.mark.asyncio
async def test_run_ssh(
    log_dir: Path,
    project_dir: Path,
    goth_config_path: Path,
    config_overrides: List[Override],
    ssh_verify_connection: bool,
) -> None:

    websocat_check = pexpect.spawn("/usr/bin/which websocat")
    exit_code = websocat_check.wait()
    if exit_code != 0:
        raise ProcessLookupError(
            "websocat binary not found, please install it or check your PATH."
        )

    configure_logging(log_dir)
    goth_config = load_yaml(goth_config_path, config_overrides)

    requestor_path = project_dir / "examples" / "ssh" / "ssh.js"

    runner = Runner(
        base_log_dir=log_dir,
        compose_config=goth_config.compose_config,
    )

    async with runner(goth_config.containers):

        requestor = runner.get_probes(probe_type=RequestorProbe)[0]

        async with requestor.run_command_on_host(
            f"node {requestor_path} --subnet-tag {SUBNET_TAG} --timeout 15",
            env=os.environ,
        ) as (_cmd_task, cmd_monitor, process_monitor):
            start_time = time.time()

            def elapsed_time():
                return f"time: {(time.time() - start_time):.1f}"

            cmd_monitor.add_assertion(assert_no_errors)
            cmd_monitor.add_assertion(assert_all_invoices_accepted)

            await cmd_monitor.wait_for_pattern(".*Created network", timeout=20)
            logger.info(f"Network created")

            await cmd_monitor.wait_for_pattern(".*Agreement proposed ", timeout=20)
            logger.info("Agreement proposed")

            await cmd_monitor.wait_for_pattern(".*Agreement confirmed ", timeout=20)
            logger.info("Agreement confirmed")

            ssh_connections = []

            # # A longer timeout to account for downloading a VM image
            for i in range(2):
                ssh_string = await cmd_monitor.wait_for_pattern(
                    "ssh -o ProxyCommand", timeout=120
                )
                matches = re.match("ssh -o ProxyCommand=('.*') (root@.*)", ssh_string)

                # the default API port goes through a proxy that logs REST requests
                # but does not support websocket connections
                # hence, we're replacing it with a port that connects directly
                # to the daemon's port in the requestor's Docker container
                proxy_cmd = re.sub(":16(\\d\\d\\d)", ":6\\1", matches.group(1))
                auth_str = matches.group(2)
                password = re.sub(
                    "Password: ", "", await cmd_monitor.wait_for_pattern("Password:")
                )
                ssh_connections.append((proxy_cmd, auth_str, password))

            if not ssh_verify_connection:
                logger.warning(
                    "Skipping SSH connection check. Use `--ssh-verify-connection` to perform it."
                )
            else:
                for proxy_cmd, auth_str, password in ssh_connections:
                    args = [
                        "ssh",
                        "-o",
                        "UserKnownHostsFile=/dev/null",
                        "-o",
                        "StrictHostKeyChecking=no",
                        "-o",
                        "ProxyCommand=" + proxy_cmd,
                        auth_str,
                        "uname -v",
                    ]

                    logger.debug("running ssh with: %s", args)

                    ssh = pexpect.spawn(" ".join(args))
                    ssh.expect("[pP]assword:", timeout=5)
                    ssh.sendline(password)
                    ssh.expect("#1-Alpine SMP", timeout=5)
                    ssh.expect(pexpect.EOF, timeout=5)
                    logger.info("Connection to %s confirmed.", auth_str)

                logger.info("SSH connections confirmed.")

            for _ in range(2):
                await cmd_monitor.wait_for_pattern("Task .* completed", timeout=20)

            await cmd_monitor.wait_for_pattern(".*Computation finished", timeout=20)
            await cmd_monitor.wait_for_pattern(".*Removed network", timeout=20)
            logger.info(f"Network removed")

            await cmd_monitor.wait_for_pattern(".*Executor has shut down", timeout=20)
            logger.info(f"Requestor script finished ({elapsed_time()})")
