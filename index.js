const core = require("@actions/core");
const github = require("@actions/github");
const { get, last } = require("lodash");

(async () => {
  try {
    core.info(`Starting...`);
    let cleanChecks = 0;

    /**
     * We confirm 3 times in case there is a deploy that is slow to start up
     */
    while (cleanChecks < 3) {
      core.info(`Running deployment check...`);
      if (await checkIfDeploymentsAreDone()) {
        cleanChecks++;
        core.info(`Passed ${cleanChecks} times`);
      } else {
        cleanChecks = 0;
        core.info(
          `Pending deployments. Checking again in ${core.getInput(
            "max_timeout"
          )} seconds...`
        );
      }

      await sleep(parseInt(core.getInput("check_interval")) * 1000);
    }
  } catch (error) {
    console.log("here");
    core.setFailed(error.message);
  }

  setTimeout(() => {
    core.setFailed(
      `Timed out after ${core.getInput(
        "max_timeout"
      )} seconds of waiting for deployments`
    );
  }, parseInt(core.getInput("max_timeout")) * 1000);
})();

async function checkIfDeploymentsAreDone() {
  const token = core.getInput("github_token");
  const octokit = github.getOctokit(token);
  const repoName = github.context.payload.repository.full_name;
  const commit = get(
    github,
    "context.payload.after",
    get(github, "context.payload.pull_request.head.sha", "")
  );
  const branch = last(
    get(
      github,
      "context.payload.ref",
      get(github, "context.payload.pull_request.head.ref", "")
    ).split("/")
  );

  // get the deploys tied to the commit
  let commitDeployments = [];
  if (commit.length > 0) {
    const { data } = await octokit.request(
      `GET /repos/${repoName}/deployments`,
      {
        ref: commit,
        per_page: 100,
      }
    );
    commitDeployments = data;
  }

  // get the deploys tied to the branch
  let branchDeployments = [];
  if (branch.length > 0) {
    const { data } = await octokit.request(
      `GET /repos/${repoName}/deployments`,
      {
        ref: branch,
        per_page: 100,
      }
    );
    branchDeployments = data;
  }

  const deployments = [...commitDeployments, ...branchDeployments];

  /**
   * Check each deployments status
   *
   * If it is error, pass it through,
   * if it is pending, return we are not done
   */
  for (const deployment of deployments) {
    const { data } = await octokit.request(
      `GET /repos/${repoName}/deployments/${deployment.id}/statuses`
    );

    const state = get(data, "0.state");

    if (state === "failure") {
      core.setFailed(`${deployment.environment} failed.`);
      throw new Error(`${deployment.environment} failed.`);
    }

    if (state === "pending") {
      return false;
    }
  }

  // if all deployments passed, we are good to go!
  return true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
