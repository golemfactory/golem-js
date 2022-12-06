import logging
import math
import os
from pathlib import Path
import re

import pytest

from goth.assertions import EventStream
from goth.configuration import load_yaml
from goth.runner.log import configure_logging
from goth.runner import Runner
from goth.runner.probe import RequestorProbe


logger = logging.getLogger("goth.test.run_yacat")

EXPECTED_KEYSPACE_SIZE = 95
ALL_TASKS = {"undefined", "0", "48"}


# Temporal assertions expressing properties of sequences of "events". In this case, each "event"
# is just a line of output from `yacat.py`.


async def assert_no_errors(output_lines: EventStream[str]):
    """Assert that no output line contains the substring `ERROR`."""
    async for line in output_lines:
        if "ERROR" in line or " error: " in line:
            raise AssertionError("Command reported ERROR")


async def assert_all_tasks_processed(status: str, output_lines: EventStream[str]):
    """Assert that for every task in `ALL_TASKS` a line with `Task {status}` will appear."""
    remaining_tasks = ALL_TASKS.copy()

    async for line in output_lines:
        m = re.search(rf".*Task {status} .* task data: (.+)", line)
        if m:
            task_data = m.group(1)
            logger.debug("assert_all_tasks_processed: Task %s: %s", status, task_data)
            remaining_tasks.discard(task_data)
        if not remaining_tasks:
            return

    raise AssertionError(f"Tasks not {status}: {remaining_tasks}")


async def assert_all_tasks_sent(output_lines: EventStream[str]):
    """Assert that for every task a line with `Task sent` will appear."""
    await assert_all_tasks_processed("sent", output_lines)


async def assert_all_tasks_computed(output_lines: EventStream[str]):
    """Assert that for every task a line with `Task computed` will appear."""
    await assert_all_tasks_processed("computed", output_lines)


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
            logger.debug("assert_all_invoices_accepted: adding invoice for '%s'", prov_name)
            unpaid_agreement_providers.remove(prov_name)

    if unpaid_agreement_providers:
        raise AssertionError(f"Unpaid agreements for: {','.join(unpaid_agreement_providers)}")


@pytest.mark.asyncio
async def test_run_yacat(
    log_dir: Path,
    project_dir: Path,
    goth_config_path: Path,
    config_overrides,
) -> None:

    goth_config = load_yaml(goth_config_path, config_overrides)

    examples_dir = project_dir / "examples"

    configure_logging(log_dir)

    runner = Runner(
        base_log_dir=log_dir,
        compose_config=goth_config.compose_config,
    )

    async with runner(goth_config.containers):

        requestor = runner.get_probes(probe_type=RequestorProbe)[0]

        async with requestor.run_command_on_host(
            f"npm run --prefix {examples_dir} ts:yacat -- -d "
            r"--mask ?a?a --hash \$P\$5ZDzPE45CigTC6EY4cXbyJSLj/pGee0 "
            "--subnet-tag goth --number-of-providers 2",
            env=os.environ,
        ) as (_cmd_task, cmd_monitor, _process_monitor):

            # Add assertions to the command output monitor `cmd_monitor`:
            cmd_monitor.add_assertion(assert_no_errors)
            cmd_monitor.add_assertion(assert_all_invoices_accepted)
            all_sent = cmd_monitor.add_assertion(assert_all_tasks_sent)
            all_computed = cmd_monitor.add_assertion(assert_all_tasks_computed)

            await cmd_monitor.wait_for_pattern(".*Received proposals from 2 ", timeout=40)
            logger.info("Received proposals")

            await cmd_monitor.wait_for_pattern(
                f".*Keyspace size computed. Keyspace size = {EXPECTED_KEYSPACE_SIZE}", timeout=120
            )
            logger.info("Keyspace found")

            await all_sent.wait_for_result(timeout=240)
            logger.info("All tasks sent")

            await all_computed.wait_for_result(timeout=240)
            logger.info("All tasks computed")

            await cmd_monitor.wait_for_pattern(".*Password found: yo", timeout=240)
            logger.info("Password found, waiting for Executor shutdown")

            await cmd_monitor.wait_for_pattern(".*Executor has shut down", timeout=240)
            logger.info("Requestor script finished")
