import { defineComponent } from "convex/server";
import { api } from "./_generated/api.js";

const component = defineComponent("loops");
(component as any).export(api, {
	addContact: api.lib.addContact,
	updateContact: api.lib.updateContact,
	findContact: api.lib.findContact,
	batchCreateContacts: api.lib.batchCreateContacts,
	unsubscribeContact: api.lib.unsubscribeContact,
	resubscribeContact: api.lib.resubscribeContact,
	countContacts: api.lib.countContacts,
	listContacts: api.lib.listContacts,
	sendTransactional: api.lib.sendTransactional,
	sendEvent: api.lib.sendEvent,
	triggerLoop: api.lib.triggerLoop,
	deleteContact: api.lib.deleteContact,
	detectRecipientSpam: api.lib.detectRecipientSpam,
	detectActorSpam: api.lib.detectActorSpam,
	getEmailStats: api.lib.getEmailStats,
	detectRapidFirePatterns: api.lib.detectRapidFirePatterns,
	checkRecipientRateLimit: api.lib.checkRecipientRateLimit,
	checkActorRateLimit: api.lib.checkActorRateLimit,
	checkGlobalRateLimit: api.lib.checkGlobalRateLimit,
});

export default component;
