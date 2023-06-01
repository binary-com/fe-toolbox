export type SlackChannel = {
    id: string;
    name: string;
    topic: string | undefined;
};

export type SlackUser = {
    color?: string;
    deleted?: boolean;
    has_2fa?: boolean;
    id: string;
    is_admin?: boolean;
    is_app_user?: boolean;
    is_bot?: boolean;
    is_email_confirmed?: boolean;
    is_invited_user?: boolean;
    is_owner?: boolean;
    is_primary_owner?: boolean;
    is_restricted?: boolean;
    is_ultra_restricted?: boolean;
    name?: string;
    real_name?: string;
    team_id?: string;
    tz?: string;
    tz_label?: string;
    tz_offset?: number;
    updated?: number;
    who_can_share_contact_card?: string;
};
