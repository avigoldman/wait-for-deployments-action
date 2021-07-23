const core = require("@actions/core");
const github = require("@actions/github");
const { get, last } = require("lodash");

(async () => {
  try {
    core.info(`Starting...`);
    let cleanChecks = 0;

    // while (cleanChecks < 3) {
    core.info(`Running check...`);
    await checkIfDeploymentsAreDone();
    // if (await checkIfDeploymentsAreDone()) {
    cleanChecks++;
    core.info(`passed ${cleanChecks} times`);
    // } else {
    //   cleanChecks = 0;
    //   core.info(`Waiting again...`);
    // }

    // await sleep(parseInt(core.getInput("max_timeout")) * 1000);
    // }
  } catch (error) {
    core.setFailed(error.message);
  }

  // setTimeout(() => {
  //   core.setFailed(
  //     `Timed out after ${core.getInput(
  //       "max_timeout"
  //     )} seconds of waiting for deployments`
  //   );
  // }, parseInt(core.getInput("max_timeout")) * 1000);
})();

async function checkIfDeploymentsAreDone() {
  const token = core.getInput("github_token");
  const octokit = github.getOctokit(token);
  const repoName = github.context.payload.repository.full_name;
  const commit = github.context.payload.after;
  console.log(JSON.stringify(context.payload, null, 2));
  // const branch = last(
  //   get(github, "context.payload.head.ref", get("context.payload.ref")).split(
  //     "/"
  //   )
  // );

  // console.log({ repoName, commit, branch });

  // const { data: commitDeployments } = await octokit.request(
  //   `GET /repos/${repoName}/deployments`,
  //   {
  //     ref: commit,
  //     per_page: 100,
  //   }
  // );

  // const { data: branchDeployments } = await octokit.request(
  //   `GET /repos/${repoName}/deployments`,
  //   {
  //     ref: branch,
  //     per_page: 100,
  //   }
  // );

  // const deployments = [...commitDeployments, ...branchDeployments];

  // for (const deployment of deployments) {
  //   const { state } = await octokit.request(
  //     `GET /repos/${repoName}/deployments/${deployment.id}/statuses`
  //   );

  //   if (state === "error") {
  //     throw new Error(`${deployment.environment} failed.`);
  //   }

  //   if (state === "pending") {
  //     return false;
  //   }
  // }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
