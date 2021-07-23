const core = require("@actions/core");
const github = require("@actions/github");
const { get, last } = require("lodash");

let timeout = setTimeout(() => {
  core.setFailed(
    `Timed out after ${core.getInput(
      "max_timeout"
    )} seconds of waiting for deployments`
  );
}, parseInt(core.getInput("max_timeout")) * 1000);

(async () => {
  core.info(`Starting...`);
  let cleanChecks = 0;

  /**
   * We confirm 3 times in case there is a deploy that is slow to start up
   */
  let deployments;
  while (cleanChecks < 3) {
    core.info(`Running deployment check... `);
    deployments = await getRelatedDeployments();
    const isPending = deployments.find(({ state }) => state === "pending");
    if (isPending) {
      cleanChecks = 0;
      core.info(
        `Pending deployments. Checking again in ${core.getInput(
          "check_interval"
        )} seconds...`
      );
    } else {
      cleanChecks++;
      core.info(`Passed ${cleanChecks} times`);
    }

    await sleep(parseInt(core.getInput("check_interval")) * 1000);
  }

  core.info(
    `${deployments.length} deployment${
      deployments.length === 1 ? "" : "s"
    } look good 🚀`
  );
  core.setOutput("deployments", deployments);
})()
  .then(() => {
    clearTimeout(timeout);
  })
  .catch((error) => {
    clearTimeout(timeout);
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

  const deployments = [...commitDeployments, ...branchDeployments];

  /**
   * get the deployment statuses
   *
   * If it it a failure, throw an error
   * Otherwise, collect it
   */
  let simplifiedDeployments = [];
  for (const deployment of deployments) {
    const { data } = await octokit.request(
      `GET /repos/${repoName}/deployments/${deployment.id}/statuses`
    );

    console.log({ data });

    const environment = deployment.environment;
    const state = get(data, "0.state");
    const url = get(data, "0.target_url");

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
