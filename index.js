const core = require("@actions/core");
const github = require("@actions/github");
const { get, last } = require("lodash");

const REQUIRED_CHECK_OUT = 3;
const ENVIRONMENT_REGEX = core.getInput("environment_filter")
  ? new RegExp(core.getInput("environment_filter"))
  : null;

Promise.race([
  sleep(parseInt(core.getInput("max_timeout")) * 1000).then(() => {
    core.setFailed(
      `Timed out after ${core.getInput(
        "max_timeout"
      )} seconds of waiting for deployments`
    );
  }),
  (async () => {
    core.info(`Starting...`);
    let cleanChecks = 0;

    /**
     * We confirm 3 times in case there is a deploy that is slow to start up
     */
    let deployments;
    while (cleanChecks < REQUIRED_CHECK_OUT) {
      core.info(`Running deployment check... `);
      deployments = await getRelatedDeployments();
      const isPending = deployments.find(({ state }) => state !== "success");
      if (isPending) {
        cleanChecks = 0;
        core.info(
          `Pending deployments. Checking again in ${core.getInput(
            "check_interval"
          )} seconds...`
        );
        await sleep(parseInt(core.getInput("check_interval")) * 1000);
      } else {
        cleanChecks++;

        if (cleanChecks < REQUIRED_CHECK_OUT) {
          core.info(
            `Passed ${cleanChecks} time${
              cleanChecks === 1 ? "" : "s"
            }. Waiting 30 seconds before next check...`
          );
          await sleep(30 * 1000);
        } else {
          core.info(
            `Passed ${cleanChecks} time${cleanChecks === 1 ? "" : "s"}.`
          );
        }
      }
    }

    core.info(
      `${deployments.length} deployment${
        deployments.length === 1 ? "" : "s"
      } look good 🚀`
    );
    core.setOutput("deployments", deployments);
  })(),
])
  .then(() => {})
  .catch((error) => {
    core.setFailed(error.message);
  });

async function getRelatedDeployments() {
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

  const deployments = [...commitDeployments, ...branchDeployments].filter(
    (deployment) =>
      ENVIRONMENT_REGEX ? ENVIRONMENT_REGEX.test(deployment.environment) : true
  );

  /**
   * get the deployment statuses
   */
  let simplifiedDeployments = [];
  for (const deployment of deployments) {
    const { data } = await octokit.request(
      `GET /repos/${repoName}/deployments/${deployment.id}/statuses`
    );

    const environment = deployment.environment;
    const state = get(data, "0.state");
    const url = get(data, "0.target_url");

    // if it's inactive, skip it
    if (state === "inactive") {
      break;
    }

    // if it's a failure, throw an error
    if (state === "failure") {
      throw new Error(`${environment} failed.`);
    }

    simplifiedDeployments.push({
      environment,
      url,
      state,
    });
  }

  return simplifiedDeployments;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
