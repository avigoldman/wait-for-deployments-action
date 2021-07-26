const core = require("@actions/core");
const github = require("@actions/github");
const toTime = require("to-time");
const { get, last } = require("lodash");

const REQUIRED_CHECK_COUNT = 3;

// get the inital delay, max run time, and check interval
const INITIAL_DELAY = toTime(core.getInput("initial_delay")).ms();
const MAX_TIMEOUT = toTime(core.getInput("max_timeout")).ms();
const CHECK_INTERVAL = toTime(core.getInput("check_interval")).ms();

// Regex to filter out whether we want to wait for a deployment
const ENVIRONMENT_REGEX = core.getInput("environment_filter")
  ? new RegExp(core.getInput("environment_filter"))
  : null;

// git details
const GIT_REPO = github.context.payload.repository.full_name;
const GIT_COMMIT = get(
  github,
  "context.payload.after",
  get(github, "context.payload.pull_request.head.sha", "")
);
const GIT_BRANCH = last(
  get(
    github,
    "context.payload.ref",
    get(github, "context.payload.pull_request.head.ref", "")
  ).split("/")
);

// octokit to make GitHub API calls
const GITHUB_TOKEN = core.getInput("github_token");
const octokit = github.getOctokit(GITHUB_TOKEN);

/**
 * Fail the process after we run out of time
 */
const timeout = sleep(MAX_TIMEOUT).then(() => {
  core.setFailed(
    `Timed out after ${MAX_TIMEOUT / 1000} seconds of waiting for deployments`
  );
});

/**
 * Run the deployment checks
 */
const runner = (async () => {
  core.info(`Starting...`);
  let cleanChecks = 0;

  /**
   * We confirm 3 times in case there is a deploy that is slow to start up
   */
  let deployments;
  while (cleanChecks < REQUIRED_CHECK_COUNT) {
    core.info(`Running deployment check... `);
    deployments = await getRelatedDeployments();
    const isPending = deployments.find(({ state }) => state !== "success");
    if (isPending) {
      cleanChecks = 0;
      core.info(
        `Pending deployments. Checking again in ${
          CHECK_INTERNVAL / 1000
        } seconds`
      );
      await sleep(CHECK_INTERVAL);
    } else {
      cleanChecks++;

      if (cleanChecks < REQUIRED_CHECK_COUNT) {
        core.info(
          `Passed ${cleanChecks} time${
            cleanChecks === 1 ? "" : "s"
          }. Waiting 30 seconds before next check...`
        );
        await sleep(30 * 1000);
      } else {
        core.info(`Passed ${cleanChecks} time${cleanChecks === 1 ? "" : "s"}.`);
      }
    }
  }

  core.info(
    `${deployments.length} deployment${
      deployments.length === 1 ? "" : "s"
    } look good 🚀`
  );
  core.setOutput("deployments", deployments);
})();

/**
 * Race the timeout and the runner
 *
 * When either finishes, kill the process.
 *
 * If either throws and error kill the process with an error.
 */
Promise.race([timeout, runner])
  .then(() => {
    process.exit();
  })
  .catch((error) => {
    core.setFailed(error.message);
    process.exit();
  });

/**
 * Returns an array of deployments tied to the GIT_COMMIT or
 * GIT_BRANCH that match the ENVIRONMENT_REGEX.
 *
 *
 */
async function getRelatedDeployments() {
  // get the deploys tied to the commit
  let commitDeployments = [];
  if (GIT_COMMIT.length > 0) {
    const { data } = await octokit.request(
      `GET /repos/${GIT_REPO}/deployments`,
      {
        ref: GIT_COMMIT,
        per_page: 100,
      }
    );
    commitDeployments = data;
  }

  // get the deploys tied to the branch
  let branchDeployments = [];
  if (GIT_BRANCH.length > 0) {
    const { data } = await octokit.request(
      `GET /repos/${GIT_REPO}/deployments`,
      {
        ref: GIT_BRANCH,
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
      `GET /repos/${GIT_REPO}/deployments/${deployment.id}/statuses`
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

/**
 * Sleep for given milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
