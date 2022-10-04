"""A goth test scenario for agreement termination."""
from functools import partial
import logging
import os
from pathlib import Path
import re

import pytest

from goth.configuration import load_yaml
from goth.runner.log import configure_logging
from goth.runner import Runner
from goth.runner.probe import RequestorProbe


logger = logging.getLogger("goth.test.agreement_termination")


async def assert_command_error(stream):
    """Assert that a worker failure is reported."""

    async for line in stream:
        m = re.match(r".*Worker for agreement ([0-9a-f]+) finished with error.*", line)
        if m:
            return m.group(1)
    raise AssertionError("Expected worker failure")


async def assert_agreement_cancelled(stream):
    """Assert that the agreement with the given id is eventually terminated.
    Fails if a new task is started for the agreement.
    """
    agr_id = await assert_command_error(stream)
    logger.info("Detected command error in activity for agreement %s", agr_id)
    async for line in stream:
        if re.match(rf".*Task started for agreement {agr_id}.*", line):
            raise AssertionError(f"Task started for agreement {agr_id}")
        if re.match(
            rf".*Terminating agreement. id: {agr_id}.*golem.requestor.code.*Cancelled.*", line
        ):
            return


async def assert_all_tasks_computed(stream):
    """Assert that for every task id, `TaskAccepted` with that id occurs."""
    remaining_ids = {1, 2, 3, 4, 5, 6}

    async for line in stream:
        m = re.search(r".*Task accepted, task_id=([0-9]+).*", line)
        if m:
            task_id = int(m.group(1))
            logger.debug("assert_all_tasks_computed: Task %d computed", task_id)
            remaining_ids.discard(task_id)
        if not remaining_ids:
            return

    raise AssertionError(f"Tasks not computed: {remaining_ids}")


@pytest.mark.asyncio
async def test_agreement_termination(
    project_dir: Path,
    goth_config_path: Path,
    config_overrides,
) -> None:

    goth_config = load_yaml(goth_config_path, config_overrides)
    test_script_path = project_dir / "tests" / "goth" / "test_agreement_termination" / "requestor.js"

    configure_logging(log_dir)

    runner = Runner(
        base_log_dir=log_dir,
        compose_config=goth_config.compose_config,
    )

    async with runner(goth_config.containers):

        requestor = runner.get_probes(probe_type=RequestorProbe)[0]

        async with requestor.run_command_on_host(f"node {test_script_path}", env=os.environ) as (
            _cmd_task,
            cmd_monitor,
            _process_monitor,
        ):

            cmd_monitor.add_assertion(assert_all_tasks_computed)

            # Make sure no new tasks are sent and the agreement is terminated
            assertion = cmd_monitor.add_assertion(assert_agreement_cancelled)
            await assertion.wait_for_result(timeout=120)

            # Wait for executor shutdown
            await cmd_monitor.wait_for_pattern(".*Shutdown complete.*", timeout=120)
            logger.info("Requestor script finished")
