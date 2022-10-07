import 'shared/components/message-versions.js';
import { __ } from 'i18n';
import { html } from "lit";
import { modal_close_button, modal_header_close_button } from "plugins/modal/templates/buttons.js"


export default (el) => {
    const nick = el.nick;
    const i18n_all_users = __('All');
    const i18n_ban = __('Ban');
    const i18n_reason = __('Optional reason');

    return html`
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title" id="message-versions-modal-label">${__('Ban user')}</h4>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body">
                    <form class="converse-form" @submit=${ev => el.submitForm(ev)}>
                    <div class="form-group">
                        <input type="radio" id="banUserNick" value="${nick}" name="ban-user" checked/>
                        <label for="banUserNick">${nick}</label>
                    </div>
                    <div class="form-group">
                        <input type="radio" id="banUserAll" name="ban-user" value="${nick} all"/>
                        <label for="banUserAll">${i18n_all_users}</label>
                    </div>
                    <div class="form-group">
                        <input type="text" class="form-control form-control--labeled" name="reason" placeholder="${i18n_reason}"/>
                    </div>
                        <div class="form-group">
                            <button type="submit" class="btn btn-primary">${i18n_ban}</button>
                            ${modal_close_button}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}