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
    merge_delay?: number;
    should_skip_circleci_checks?: string;
    should_skip_pending_checks?: string;
};
