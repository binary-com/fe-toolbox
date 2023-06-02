export const MERGE_DELAY = 2 * 60 * 1000;
export const PULL_REQUEST_CHECKS_TIMEOUT = 1 * 60 * 1000; // 1 minute
export const PULL_REQUEST_REFETCH_TIMEOUT = 5 * 1000; // 5 seconds
export const PULL_REQUEST_REFETCH_LIMIT = 10; // the max amount of refetches to check for a pull request's status checks
export const PULL_REQUEST_CHECKS_LIMIT = 120;

export const CIRCLECI_API_URL = "https://circleci.com/api/v2";
export const CLICKUP_API_URL = "https://api.clickup.com/api/v2";
export const REDMINE_API_URL = "https://redmine.deriv.cloud";


export enum STATUSES {
    PENDING_QA = 'Pending - QA',
    READY_RELEASE = 'Ready - Release',
    MERGED_RELEASE = 'Merged - Release'
}