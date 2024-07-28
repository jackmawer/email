async function handleEmail(message, env, ctx) {
	const temp = JSON.parse(await env.config.get("mawer.uk"));
	const forwardAddresses = temp.routes;
	const catchAll = temp.fallback;
	  
	for (const [addr, dest] of Object.entries(forwardAddresses)) {
		if (message.to.startsWith(addr)) {
		  await message.forward(dest);
		  return;
		}
	  }
  
	  if (catchAll) {
		await message.forward(catchAll);
		return;
	  }
	  message.setReject("550 5.1.1 User unknown");
	  return;
}

export default {
	email: handleEmail,
};