async function handleEmail(message, env, ctx) {
	const configMeta = await env.config.list();
	const domains = configMeta.keys.map(key => key.name);
	
	// Email comes in - get the domain part of the email.
	const incomingDomain = message.to.split("@")[1];

	// Check if the domain is in the config.
	if (domains.includes(incomingDomain)) {
		const domainConfig = JSON.parse(await env.config.get(incomingDomain));
		const routes = domainConfig.routes;
		const fallback = domainConfig.fallback;

		// Split the username part by dot or plus.
		const username = message.to.split("@")[0].split(/\.|\+/)[0];

		// Check if the username is in the routes.
		if (username in routes) {
			for (let forwardingAddr of (routes[username].isArray() ? routes[username] : routes[username].flat())) {
				await message.forward(forwardingAddr);
			}
		} else {
			// No route for this user, check if there is a fallback.
			if (fallback) {
				//TODO: should we also try the global fallback in this case?
				await message.forward(fallback);
			} else {
				console.warn(`Got email for user ${username} of domain ${incomingDomain} but no routes configured for that user and no fallback address available.`);
				message.setReject("550 5.1.1 User unknown");
			}
		}
	} else {
		// We got an email for a domain that isn't configured.
		// Check if there is a fallback address configured.
		if (domains.includes("fallback")) {
			console.warn(`Got email for domain ${incomingDomain} but no routes configured. Falling back to ${env.config.get('fallback')}`);
			await message.forward(env.config.get('fallback'));
		} else {
			console.warn(`Got email for domain ${incomingDomain} but no routes configured and no fallback address available.`);
			message.setReject("550 5.1.1 User unknown");
		}
	}
}

export default {
	email: handleEmail,
};
