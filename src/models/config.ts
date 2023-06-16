export type ConfigFile = {
    circleci?: {
        project_slug?: string;
        branch?: string;
        workflow_name?: string;
    };
    pull_request?: {
        checks_limit?: number;
        checks_timeout?: number;
        refetch_timeout?: number;
        refetch_limit?: number;
    };
    max_task_count?: number;
    merge_delay?: number;
    first_merge_delay?: number;
    skip_circleci_checks?: boolean;
    skip_pending_checks?: boolean;
    skip_slack_integration?: boolean;
    skip_updating_branch?: boolean;
    skip_failing_checks?: boolean;
    checks_to_skip?: string[];
};