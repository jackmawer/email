async function handleEmail(message, env, ctx) {
	const configMeta = await env.config.list();
	const incomingDomain = (message.to || "").split("@")[1];

	// Check if the domain is in the config.
	const domains = (Array.isArray(configMeta.keys) ? configMeta.keys : []).map(key => key.name);
	if (domains.includes(incomingDomain)) {
		const domainConfig = JSON.parse(await env.config.get(incomingDomain));
		
		// Split the username part by dot or plus.
		const username = message.to.split("@")[0].split(/\.|\+/)[0];
		
		// Check if the username is in the routes.
		if (username in domainConfig.routes) {
			return handleEmailSend(message, domainConfig.routes[username])
		}
		
		//TODO: should we also try the global fallback in this case?
		if (domainConfig.fallback) {
			return await message.forward(domainConfig.fallback);
		}

		console.warn(`Got email for user ${username} of domain ${incomingDomain} but no routes configured for that user and no fallback address available.`);
		message.setReject("550 5.1.1 User unknown");
		return;
	} 
	
	if (domains.includes("fallback")) {
		console.warn(`Got email for domain ${incomingDomain} but no routes configured. Falling back to ${env.config.get('fallback')}`);
		await message.forward(env.config.get('fallback'));
		return
	}
	
	console.warn(`Got email for domain ${incomingDomain} but no routes configured and no fallback address available.`);
	message.setReject("550 5.1.1 User unknown");
}

async function handleEmailSend(message, forwardingAddr) {
	return Promise.all(
		(Array.isArray(forwardingAddr) ? forwardingAddr : [forwardingAddr])
			   .map(email => message.forward(forwardingAddr)
	);
}

export default {
	email: handleEmail,
};
