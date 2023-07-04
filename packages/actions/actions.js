(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(["converse"], factory);
    } else {
        factory(converse);
    }
}(this, function (converse) {
    let __, html, _converse, modal, purgeModal;

    converse.plugins.add("actions", {
        'dependencies': [],

        'initialize': function () {
            _converse = this._converse;
            __ = _converse.__;
            html = converse.env.html;
            modal = converse.env.BootstrapModal;

            _converse.api.settings.update({
                actions_reply: true
            });

            _converse.api.listen.on('parseMessage', async (stanza, attrs) => {
                return parseStanza(stanza, attrs);
            });

            _converse.api.listen.on('parseMUCMessage', async (stanza, attrs) => {
                return parseStanza(stanza, attrs);
            });

            _converse.api.listen.on('getMessageActionButtons', (el, buttons) => {

                if (_converse.api.settings.get("actions_reply") === true) {
                    buttons.push({'i18n_text': __('Reply'),   'handler': ev => handleReplyAction(el.model), 'button_class': 'chat-msg__action-reply', 'icon_class': 'fas fa-arrow-left',  'name': 'action-reply'});
                }

                const reactions = _converse.api.settings.get("actions_reactions");
                if(reactions) {
                    for (let reaction of reactions) {
                        buttons.push({
                            'i18n_text': __(reaction.label),
                            'handler': ev => handleReactionAction(el.model, reaction.emoji),
                            'button_class': 'chat-msg__action-' + reaction.name,
                            'icon_class': reaction.icon_class,
                            'name': 'action-' + reaction.name
                        });
                    }
                }
                const chatroom = getChatBoxFromMessageModel(el.model)?.model;

                if (chatroom && chatroom.get('type') === 'chatroom' && chatroom.getOwnRole() && chatroom.getOwnRole() === 'moderator'){
                    buttons.push({
                        'i18n_text': __('Purge'),
                        'handler': ev => handlePurgeAction(el.model, ev),
                        'button_class': 'chat-msg__action-purge',
                        'icon_class': 'fa fa-trash',
                        'name': 'action-purge'
                    });
                }
                return buttons;
            });

            purgeModal = modal.extend({
                id: 'plugin-purge-modal',

                toHTML() {
                    const nick = this.model.get('nick');
                    const i18n_all_users = __('All');
                    const i18n_purge = __('Purge messages');

                    return html`
                        <div class="modal-dialog" role="document">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h4 class="modal-title" id="message-versions-modal-label">${__('Purge messages')}</h4>
                                    <button type="button" class="close" data-dismiss="modal" aria-label="${__('Close')}"><span aria-hidden="true">×</span></button>
                                </div>
                                <div class="modal-body">
                                    <form class="converse-form" @submit=${ev => this.submitForm(ev)}>
                                        <div class="form-group">
                                            <input type="radio" id="purgeByNick" value="${nick}" name="purge-user"
                                                   checked/>
                                            <label for="purgeByNick">${nick}</label>
                                        </div>
                                        <div class="form-group">
                                            <input type="radio" id="purgeAll" name="purge-user" value="all"/>
                                            <label for="purgeAll">${i18n_all_users}</label>
                                        </div>
                                        <div class="form-group">
                                            <button type="submit" class="btn btn-primary">${i18n_purge}</button>
                                            <button type="button" class="btn btn-secondary" data-dismiss="modal">${__('Close')}</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    `;
                },
                submitForm(ev) {
                    ev.preventDefault();

                    const form = ev.currentTarget;
                    const nick = form.elements['purge-user'].value;

                    const msg = $msg({
                        to: this.model.collection.chatbox.get('jid'),
                        from: _converse.connection.jid,
                        type: 'groupchat'
                    }).c('body').t(`/purge ${nick}`);

                    _converse.api.send(msg);

                    this.modal.hide();
                }
            });

            _converse.api.listen.on('connected', function() {
                setupTimer();
            });

            console.debug("actions plugin is ready");
        }
    });

    async function parseStanza(stanza, attrs) {
        const reactions = stanza.querySelector('reactions');

        if (reactions) {
            attrs.reaction_id = reactions.getAttribute('id');
            attrs.reaction_emoji = reactions.querySelector('reaction').innerHTML;
            console.debug("parseStanza", stanza, attrs);
        }
        return attrs;
    }

    function handleReplyAction(model) {
        console.debug('handleReplyAction', model)

        let selectedText = window.getSelection().toString();
        const nick = model.get('nick') || model.get('nickname');

        if (!selectedText || selectedText === '') selectedText = model.get('message');
        replyChat(model, nick, selectedText);
    }

    function handlePurgeAction(model, ev){
        ev.preventDefault();

        let purgeMsgsModal = new purgeModal({ model: model});
        purgeMsgsModal.show(ev);
    }

  function handleReactionAction(model, emoji) {
        console.debug('handleReactionAction', model, emoji);
        const msgId = model.get('msgid');
        const type = model.get("type");

        let target = getTargetJidFromMessageModel(model);

        let message = window.getSelection().toString();

        if (!message || message === '') {
            message = model.get('message');
        }

        if (msgId) {
            if (type === "chat") {
                model.save('reaction_id', msgId);
                model.save('reaction_emoji', emoji);
            }
            const nick = model.get('nickname') || model.get('nick') || Strophe.getNodeFromJid(model.get('from'));
            const originId = uuidv4();
            const body = normalizeTextMention(nick, message) + emoji;
            _converse.api.send($msg({to: target, from: _converse.connection.jid, type}).c('body').t(body).up().c("reactions", {'xmlns': 'urn:xmpp:reactions:0', 'id': msgId}).c('reaction').t(emoji).up().up().c('origin-id', {'xmlns': 'urn:xmpp:sid:0', 'id': originId}));
        }
    }

    function replyChat(model, nick, text) {

        console.debug("replyChat", model, nick, text);

        const box = getChatBoxFromMessageModel(model);
        if (box)
        {
            const textArea = box.querySelector('.chat-textarea');
            if (textArea) textArea.value = normalizeTextMention(nick, text);
        }
    }

    function uuidv4() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    function normalizeTextMention(nick, message) {
        const regexp = />[^>]+?\n(.*)/;
        const quote = message.match(regexp);

        if(quote && quote.length > 1){
            message = quote[1];
        }
        return ">" + nick + ' : ' + message.replace(/^>/,"\n>") + "\n";
    }

    function getTargetJidFromMessageModel(model) {
        const type = model.get("type");
        let target = model.get('from_muc');
        if (type === "chat")  {
            target = model.get('jid');
            if (model.get('sender') === 'them') {
                target = model.get('from');
            }
        }
        return target;
    }

    function getChatBoxFromMessageModel(model) {
        const view = _converse.chatboxviews.get(getTargetJidFromMessageModel(model));

        console.debug("getChatBoxFromMessageModel", view);

        return view;
    }

    function setupTimer() {
        //console.debug("setupTimer render");
        renderReactions();
        setTimeout(setupTimer, 10000);
    }

    function renderReactions() {
        const models = _converse.chatboxes.models;
        //console.debug("rections render", models);
        const msgReactions = new Map();

        for (model of models)
        {
            if (model.messages)
            {
                for (message of model.messages.models)
                {
                    const reactionId = message.get('reaction_id');
                    const reactionEmoji = message.get('reaction_emoji');

                    if (reactionId)
                    {
                        //console.debug("renderReactions", model.get('id'), reactionId, reactionEmoji);

                        if (!msgReactions.has(reactionId)) {
                            msgReactions.set(reactionId, {emojis: new Map(), reactionId});
                        }

                        const emojis = msgReactions.get(reactionId).emojis;

                        if (!emojis.has(reactionEmoji)) {
                            emojis.set(reactionEmoji, {count: 0, code: converse.env.utils.shortnamesToEmojis(reactionEmoji)});
                        }

                        emojis.get(reactionEmoji).count++;
                    }
                }
            }
        }

        for (const reaction of msgReactions.values()) {
            //console.debug("rections item", reaction);
            const el = document.querySelector('[data-msgid="' + reaction.reactionId + '"]');

            if (el) {
                let reactionDiv = el.querySelector('.pade-reaction');

                if (!reactionDiv) {
                    const msgText = el.querySelector('.chat-msg__text');
                    reactionDiv = newElement('div', null, null, 'pade-reaction');
                    msgText.insertAdjacentElement('afterEnd', reactionDiv);
                }

                let div = "";

                for (const emoji of reaction.emojis.values()) {
                    //console.debug("rections emoji", emoji);
                    div = div + '<span class="chat-msg__reaction">' + emoji.code + '&nbsp' + emoji.count + '</span>';
                }

                reactionDiv.innerHTML = div;
            }
        }
    }

    function newElement(el, id, html, className) {
        const ele = document.createElement(el);
        if (id) ele.id = id;
        if (html) ele.innerHTML = html;
        if (className) ele.classList.add(className);
        document.body.appendChild(ele);
        return ele;
    }

}));