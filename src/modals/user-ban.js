import BootstrapModal from "plugins/modal/base.js";
import tpl_user_ban_modal from "./templates/user-ban.js";
import { _converse, api, converse } from '@converse/headless/core.js';

const { $msg } = converse.env;


export default BootstrapModal.extend({
    id: "user-ban-modal",

    toHTML () {
        return tpl_user_ban_modal({
                'nick': this.model.get('nick'),
                'submitForm': ev => this.submitForm(ev),
            });
    },

    submitForm(ev) {
        ev.preventDefault();

        const form = ev.currentTarget;
        const nick = form.elements['ban-user'].value;
        const reason = form.elements['reason'].value;

        const msg = $msg({
            to: this.model.collection.chatbox.get('jid'),
            from: _converse.connection.jid,
            type: 'groupchat'
        }).c('body').t(`/ban ${nick} ${reason}`);

        api.send(msg);

        this.modal.hide();
    }
});
