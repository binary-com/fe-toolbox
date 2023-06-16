import {
    App,
    Block,
    Middleware,
    SlackAction,
    SlackActionMiddlewareArgs,
    SlackEventMiddlewareArgs,
    SlackViewAction,
    SlackViewMiddlewareArgs,
} from '@slack/bolt';
import { SLACK_APP_TOKEN, SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_USER_TOKEN } from '../config';
import { VIEWS } from '../../models/views';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import { ACTIONS } from '../../models/actions';
import { SlackChannel, SlackUser } from '../../models/slack';
import logger from '../logger';

class Slack {
    slack;
    channels: Map<string, SlackChannel> = new Map();

    constructor() {
        this.slack = new App({
            token: SLACK_BOT_TOKEN,
            appToken: SLACK_APP_TOKEN,
            signingSecret: SLACK_SIGNING_SECRET,
            socketMode: true,
        });
    }

    registerAction(
        action_id: ACTIONS | RegExp,
        listener: Middleware<SlackActionMiddlewareArgs<SlackAction>, StringIndexed>
    ) {
        this.slack.action(action_id, listener);
    }

    registerEvent<T extends string>(event_name: T, listener: Middleware<SlackEventMiddlewareArgs<T>, StringIndexed>) {
        this.slack.event(event_name, listener);
    }

    registerView(view_id: VIEWS, listener: Middleware<SlackViewMiddlewareArgs<SlackViewAction>, StringIndexed>) {
        this.slack.view(view_id, listener);
    }

    /**
     * @async
     * Fetches a list of channels in a workspace
     */
    async fetchChannels() {
        logger.log('Fetching list of channels in Slack...');
        const { channels } = await this.slack.client.conversations.list();
        channels?.forEach(channel => {
            if (channel.id) {
                this.channels.set(<string>channel.name, {
                    id: channel.id,
                    name: channel.name || '',
                    topic: channel.topic?.value,
                });
            }
        });
    }

    /**
     * Retrieve a channel's topic
     *
     * @async
     * @param {string} channel_name - The channel name to retrieve its topic
     */
    async getChannelTopic(channel_name: string): Promise<string | undefined> {
        logger.log(`Getting channel topic ${channel_name}...`);
        if (!this.channels.has(channel_name)) {
            await this.fetchChannels();
        }

        return this.channels.get(channel_name)?.topic;
    }

    /**
     * Set a channel's topic
     *
     * @async
     * @param {string} channel_name - The channel name to set its topic
     * @param {string} topic - The new topic to be set in the channel
     */
    async setChannelTopic(channel_name: string, topic: string) {
        if (!this.channels.has(channel_name)) {
            // lazy fetch list of channels
            await this.fetchChannels();
        }

        const channel_id = this.channels.get(channel_name)?.id;
        logger.log(`Updating topic in ${channel_name}...`);
        if (channel_id) {
            await this.slack.client.conversations
                .setTopic({
                    token: SLACK_USER_TOKEN,
                    channel: channel_id,
                    topic,
                })
                .catch(err => console.log('oh no', err));
        }
    }

    /**
     * Update a channel's topic based on a matched string `status_to_match`.
     * The matched string `status_to_match` will only be updated, while retaining the unmatched strings in the topic.
     *
     * @async
     * @param {string} channel_name - The channel name to set update its topic
     * @param {string} status_to_match - A string to match within the channel topic.
     * @param {string} status_to_replace - The replaced string to be updated in the channel topic
     */
    async updateChannelTopic(channel_name: string, status_to_match: string, status_to_replace: string) {
        const topic = await this.getChannelTopic(channel_name);
        if (topic) {
            let has_status = false;
            const tokens = topic.split('\n').map(token => {
                if (token.includes(status_to_match)) {
                    has_status = true;
                    return status_to_replace;
                }
                return token;
            });

            if (!has_status) tokens.push(status_to_replace);
            
            const tokens_length = tokens.reduce((total, token) => total += token.length, 0)
            if (tokens_length >= 250) {
                logger.log(`Unable to update Slack topic for channel ${channel_name}, topic is too long to update!`, 'error')
            } else {
                await this.setChannelTopic(channel_name, tokens.join('\n'));
            }
        }
    }

    /**
     * Retrieves a Slack user based on their email.
     * This checks the user's email for both @regentmarkets.com and @deriv.com domains in case where user has different registered domain emails from Clickup and Slack.
     *
     * @async
     * @param {string} email - the email of the Slack user
     */
    async getUserFromEmail(email: string): Promise<SlackUser | undefined> {
        const match = /(^[a-z\-\._]+)@(deriv|regentmarkets).com/.exec(email);
        if (match) {
            const username = match[1];
            const user_regentmarkets = await this.slack.client.users.lookupByEmail({
                email: `${username}@regentmarkets.com`,
            });
            if (user_regentmarkets.user?.id) {
                return user_regentmarkets.user as SlackUser;
            } else {
                const user_deriv = await this.slack.client.users.lookupByEmail({ email: `${username}@deriv.com` });
                if (user_deriv.user?.id) {
                    return user_deriv.user as SlackUser;
                }
            }
        }
    }

    /**
     * Sends a message to a Slack user
     *
     * @async
     * @param {string} user_id - The Slack's user ID
     * @param {string} text - The preview message text to be shown. This text will be visible in the notification body when the user receives a notification from Slack of the message
     * @param {string} blocks - The Slack blocks UI object to be rendered in the message
     */
    async sendMessage(user_id: string, text: string, blocks: Block[]) {
        await this.slack.client.chat.postMessage({
            channel: user_id,
            text,
            blocks,
        });
    }

    startBot = async () => {
        await this.slack.start(6969);

        // action_manager.registerActions();
        // event_manager.registerEvents();
        logger.log('⚡️ Paimon the Release Bot is running!');
    };
}

export default new Slack();
