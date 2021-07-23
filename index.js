const core = require("@actions/core");
const github = require("@actions/github");
const { get, last } = require("lodash");

console.log("here1")(async () => {
  console.log("here2");
  core.info(`Starting...`);
  // let cleanChecks = 0;

  // while (cleanChecks < 3) {
  //   if (await checkIfDeploymentsAreDone()) {
  //     cleanChecks++;
  //     core.info(`passed ${cleanChecks} times`);
  //   } else {
  //     cleanChecks = 0;
  //     core.info(`Waiting again...`);
  //   }

  //   await sleep(parseInt(core.getInput("max_timeout")) * 1000);
  // }

  // setTimeout(() => {
  //   core.setFailed(
  //     `Timed out after ${core.getInput(
  //       "max_timeout"
  //     )} seconds of waiting for deployments`
  //   );
  // }, parseInt(core.getInput("max_timeout")) * 1000);
})();

// async function checkIfDeploymentsAreDone() {
//   try {
//     const token = core.getInput("github_token");
//     const octokit = github.getOctokit(token);
//     const repoName = github.context.payload.repository.full_name;
//     const commit = github.context.payload.after;
//     const branch = last(
//       get(github, "context.payload.head.ref", get("context.payload.ref")).split(
//         "/"
//       )
//     );

//     const { data: commitDeployments } = await octokit.request(
//       `GET /repos/${repoName}/deployments`,
//       {
//         ref: commit,
//         per_page: 100,
//       }
//     );

//     const { data: branchDeployments } = await octokit.request(
//       `GET /repos/${repoName}/deployments`,
//       {
//         ref: branch,
//         per_page: 100,
//       }
//     );

//     const deployments = [...commitDeployments, ...branchDeployments];

//     for (const deployment of deployments) {
//       const { state } = await octokit.request(
//         `GET /repos/${repoName}/deployments/${deployment.id}/statuses`
//       );

//       if (state === "error") {
//         throw new Error(`${deployment.environment} failed.`);
//       }

//       if (state === "pending") {
//         return false;
//       }
//     }
//   } catch (error) {
//     core.setFailed(error.message);
//   }
// }

// function sleep(ms) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }
