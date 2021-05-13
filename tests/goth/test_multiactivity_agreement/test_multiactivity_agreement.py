"""A goth test scenario for multi-activity agreements."""
from functools import partial
import logging
import os
from pathlib import Path
import re

import pytest

import goth.configuration
from goth.runner import Runner
from goth.runner.probe import RequestorProbe
from goth.runner.log import configure_logging


logger = logging.getLogger("goth.test.multiactivity_agreement")


async def assert_agreement_created(events):
    async for line in events:
        m = re.match(r".*New agreement. id: ([^,]+)", line)
        if m:
            return m.group(1)
    raise AssertionError("Expected new agreement log message")


async def assert_multiple_workers_run(agr_id, events):
    """Assert that more than one worker is run with given `agr_id`.
    Fails if a worker failure is detected or if a worker has run for another agreement.
    """
    workers_finished = 0

    async for line in events:
        m = re.match(r".*Stopped worker related to agreement ([0-9a-f]+)", line)
        if m:
            worker_agr_id = m.group(1)
            assert worker_agr_id == agr_id, "Worker run for another agreement"
            assert " finished with error" not in line, "Worker finished with error"
            workers_finished += 1
        elif re.match(".*Computation finished in", line):
            break

    assert workers_finished > 1, (
        f"Only {workers_finished} worker(s) run for agreement {agr_id}, " "expected more than one"
    )


@pytest.mark.asyncio
async def test_multiactivity_agreement(project_dir: Path, log_dir: Path, config_overrides) -> None:

    configure_logging(log_dir)

    # Override the default test configuration to create only one provider node
    nodes = [
        {"name": "requestor", "type": "Requestor"},
        {"name": "provider-1", "type": "VM-Wasm-Provider", "use-proxy": True},
    ]
    config_overrides.append(("nodes", nodes))
    goth_config = goth.configuration.load_yaml(
        project_dir / "tests" / "goth" / "assets" / "goth-config.yml",
        config_overrides,
    )

    runner = Runner(base_log_dir=log_dir, compose_config=goth_config.compose_config)

    requestor_path = project_dir / "tests" / "goth" / "test_multiactivity_agreement" / "requestor.js"

    async with runner(goth_config.containers):

        requestor = runner.get_probes(probe_type=RequestorProbe)[0]

        async with requestor.run_command_on_host(
            f"node {requestor_path}", env=os.environ
        ) as (_cmd_task, cmd_monitor):

            # Wait for agreement
            assertion = cmd_monitor.add_assertion(assert_agreement_created)
            agr_id = await assertion.wait_for_result(timeout=120)

            # Wait for multiple workers run for the agreement
            assertion = cmd_monitor.add_assertion(
                partial(assert_multiple_workers_run, agr_id),
                name=f"assert_multiple_workers_run({agr_id})",
            )
            await assertion.wait_for_result(timeout=120)
