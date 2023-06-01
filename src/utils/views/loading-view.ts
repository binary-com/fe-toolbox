import { HomeView } from '@slack/types';
import { Window } from '.';
import { VIEWS, ViewArgs } from 'models/views';
import { ActionArgs } from 'models/actions';

export class LoadingView implements Window {
    load(): HomeView {
        return {
            type: 'home',
            callback_id: VIEWS.LOADING_VIEW,
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: '⏳ Loading...',
                        emoji: true,
                    },
                },
            ],
        };
    }

    mount = async <T extends ActionArgs | ViewArgs>(payload: T) => {
        const { body, client } = payload;

        await client.views.publish({
            user_id: body.user.id,
            view: this.load(),
        });
    };
}
