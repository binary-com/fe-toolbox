import dotenv from 'dotenv';
import path from 'path';
import * as core from '@actions/core';
import * as github from '@actions/github';

dotenv.config({ path: path.resolve(__dirname, '../../secrets.env') });

export const CIRCLECI_TOKEN = process.env.CIRCLECI_TOKEN || core.getInput('CIRCLECI_TOKEN', { required: true });
export const CLICKUP_API_TOKEN =
    process.env.CLICKUP_API_TOKEN || core.getInput('CLICKUP_API_TOKEN', { required: true });
export const REDMINE_API_TOKEN = process.env.REDMINE_API_TOKEN || '';
export const GITHUB_PERSONAL_TOKEN =
    process.env.GITHUB_PERSONAL_TOKEN || core.getInput('GITHUB_TOKEN', { required: true });
export const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN || core.getInput('SLACK_APP_TOKEN', { required: true });
export const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || core.getInput('SLACK_BOT_TOKEN', { required: true });
export const SLACK_USER_TOKEN = process.env.SLACK_USER_TOKEN || core.getInput('SLACK_USER_TOKEN', { required: true });
export const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
export const GITHUB_REPO = process.env.GITHUB_REPO || github.context.repo.repo;
export const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || github.context.repo.owner;
export const GITHUB_REPO_CONFIG = {
    repo: GITHUB_REPO,
    owner: GITHUB_REPO_OWNER,
};
export const LIST_ID = core.getInput('list_id', { required: true });
export const TAG = core.getInput('tag', { required: true });
export const PLATFORM = core.getInput('platform', { required: false }) || 'Deriv.app';
// if you are wondering why these 2 equates to === 'true', https://github.com/actions/runner/issues/1483
export const SHOULD_SKIP_PENDING_CHECKS = core.getInput('skip_pending_checks', { required: false }) === 'true' || false;
export const SHOULD_SKIP_CIRCLECI_CHECKS =
    core.getInput('skip_circleci_checks', { required: false }) === 'true' || false;
export const RELEASE_TAGS_LIST_ID = core.getInput('release_tags_list_id', { required: true });
export const REGRESSION_TESTING_TEMPLATE_ID = core.getInput('regression_testing_template_id', { required: true });
export const CIRCLECI_PROJECT_SLUG =
    core.getInput('circleci_project_slug', { required: false }) || 'gh/binary-com/SmartCharts';
export const CIRCLECI_BRANCH = 'master';
export const CIRCLECI_WORKFLOW_NAME = core.getInput('circleci_workflow_name', { required: false }) || 'release_staging';
