export default {
  async email(message, env, ctx) {
    return await handleEmail(message, env, ctx);
  },

  async fetch(request, env, ctx) {
    return new Response("Hello World!");
  },
};

async function handleEmail(message, env, ctx) {
	const forwardAddresses = JSON.parse(env.FORWARD_ADDRESSES); // e.g. { "jack": "jack@example.com" }
	  const catchAll = env.CATCH_ALL; // e.g. "jack@example.com"
	  
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