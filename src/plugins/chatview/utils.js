import { __ } from 'i18n';
import { _converse, api } from '@converse/headless/core';

export function clearHistory (jid) {
    if (_converse.router.history.getFragment() === `converse/chat?jid=${jid}`) {
        _converse.router.navigate('');
    }
}

export async function clearMessages (chat) {
    const result = await api.confirm(__('Are you sure you want to clear the messages from this conversation?'));
    if (result) {
        await chat.clearMessages();
    }
}

export function parseMessageForPrivate(text){
    const regex = /!@(.+?)\s(.*)/s;
    const match = text.trim().match(regex);

    if(match && match.length > 1){
        return {'recipient': match[1], 'text': match[2]};
    }
}

export function parseMessageForReply(chat, text, is_private) {
    const str = is_private ? is_private.text : text?.trim();
    const regex = />[^>]+?(\n(.*)|$)/;
    const match = str.match(regex);
    const reply_info = chat?.get('reply');

    if (match && match.length > 1 && reply_info.msgId) {
        const message = !match[1] ? '': match[2];
        return {
            'message': message,
            'msgId': reply_info.msgId,
            'stanzaId': reply_info.stanzaId,
            'from_jid': reply_info.from_jid,
            'end': match[0].length - message.length
        };
    }
}

export async function parseMessageForCommands (chat, text) {
    const match = text.replace(/^\s*/, '').match(/^\/(.*)\s*$/);
    if (match) {
        let handled = false;
        /**
         * *Hook* which allows plugins to add more commands to a chat's textbox.
         * Data provided is the chatbox model and the text typed - {model, text}.
         * Check `handled` to see if the hook was already handled.
         * @event _converse#parseMessageForCommands
         * @example
         *  api.listen.on('parseMessageForCommands', (data, handled) {
         *      if (!handled) {
         *         const command = (data.text.match(/^\/([a-zA-Z]*) ?/) || ['']).pop().toLowerCase();
         *         // custom code comes here
         *      }
         *      return handled;
         *  }
         */
        handled = await api.hook('parseMessageForCommands', { model: chat, text }, handled);
        if (handled) {
            return true;
        }

        if (match[1] === 'clear') {
            clearMessages(chat);
            return true;
        } else if (match[1] === 'close') {
            _converse.chatboxviews.get(chat.get('jid'))?.close();
            return true;
        }
    }
    return false;
}

export function resetElementHeight (ev) {
    if (ev.target.value) {
        const height = ev.target.scrollHeight + 'px';
        if (ev.target.style.height != height) {
            ev.target.style.height = 'auto';
            ev.target.style.height = height;
        }
    } else {
        ev.target.style = '';
    }
}
