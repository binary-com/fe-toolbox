# Overview

Using this action on your repository will trigger the release workflow for frontend releases in Clickup.
You may find an example workflow in the `.github/workflows` folder.

## How it works

The action retrieves all tasks in Clickup under the `list_relationship` field of the `regression task` whose `url` is provided in the input `release_tag_task_url` in Clickup with the status `Ready - Release` and merges them one by one, checking if the task's pull request has the following criterias:

-   Has at least 2 review approvals
-   Has passed all pull request checks
-   Does not have merge conflicts with the base branch

Any tasks that do not match all of these criterias will not be merged. Users assigned to the tasks will be notified of the issues above. Tasks that pass all of these criterias will be merged and the `regression` task will be moved to `PENDING - QA` status after the merge is complete.

### Inputs

-   `CLICKUP_API_TOKEN`: The Clickup API token to be used for fetching all cards to be released in the release space, creating tags and regression testing card
-   `GITHUB_TOKEN`: The GitHub access token (e.g. secrets.GITHUB_TOKEN) with write access. This defaults to {{ github.token }}.
-   `SLACK_APP_TOKEN`: The Slack app token associated with the Slack app to be used for updating channels and notifying users
-   `SLACK_BOT_TOKEN`: The Slack bot token associated with the Slack app to be used for updating channels and notifying users
-   `SLACK_USER_TOKEN`: The Slack bot token associated with the Slack app to be used for updating channels and notifying users
-   `CIRCLECI_TOKEN`: The CircleCI token used to check the release staging workflow status

## Development

The main release workflow logic is under `src/utils/workflow.ts`. The manager, slack and views folders contains files which are deprecated and no longer maintained since its associated with the Slack bot implementation.

After making changes to any files, run `npm run bundle` to compile to `dist/index.js` and bundle all dependencies into `bundle/index.js`. To watch for any changes while developing, run `npm run dev`.
