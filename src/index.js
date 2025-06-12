import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

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
		const username = message.to.split("@")[0].split(/\.|\+/)[0].toLowerCase();

		// Check if the username is in the routes.
		if (username in routes ?? {}) {
			const rawAddrs = Array.isArray(routes[username]) ? routes[username] : [routes[username]];
			for (let addr of rawAddrs) {
				const finalAddrs = await resolveFinalAddresses(addr, domainConfig, env);
				for (let finalAddr of finalAddrs) {
					try {
						await message.forward(finalAddr);
					} catch (err) {
						console.error(`Error forwarding email for user ${username} to ${finalAddr}:`, err);
						await handleForwardErr(err, finalAddr, message.from, env);
						message.setReject(`450 4.4.1 No answer from host`);
					}
				}
			}

		} else {
			// No route for this user, check if there is a fallback.
			if (fallback) {
				//TODO: should we also try the global fallback in this case?
				try {
					await message.forward(fallback);
				} catch (err) {
					console.error(`Error forwarding email for user ${username} to ${forwardingAddr}:`, err);
					await handleForwardErr(err, fallback, message.from, env);
					// Send a rejection message indicating a temporary failure
					message.setReject(`450 4.4.1 No answer from host`);
				}
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

async function handleForwardErr(err, addr, from, env) {
	const msg = createMimeMessage();
	msg.setSender({ name: "CF Forwarding Errors", addr: "postmaster@mawer.uk" });
	msg.setRecipient(addr);
	msg.setSubject("Email forwarding error - " + from);
	msg.addMessage({
		contentType: "text/plain",
		data: `There was an error forwarding an email from ${from} to ${addr}.\n\nError: ${err.message}\n\nPlease check the configuration for this address.`,
	});
	const message = new EmailMessage(
		"postmaster@mawer.uk",
		addr,
		msg.asRaw()
	);
	await env.MAILER.send(message); // This might also fail, but I'm not handling that for now.
}

async function resolveFinalAddresses(addr, config, env, visited = new Set()) {
	if (visited.has(addr)) {
		console.warn(`Detected forwarding loop involving ${addr}`);
		return [];
	}
	visited.add(addr);

	if (addr in config.routes) {
		const next = config.routes[addr];
		const nextAddrs = Array.isArray(next) ? next : [next];
		let resolved = [];
		for (const nextAddr of nextAddrs) {
			const deeper = await resolveFinalAddresses(nextAddr, config, env, visited);
			resolved.push(...deeper);
		}
		return resolved;
	} else {
		return [addr];
	}
}


export default {
	email: handleEmail,
};
