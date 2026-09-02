# The API.
#
# TypeScript runs through tsx rather than being compiled to JavaScript first.
# That is a deliberate trade: a build step is one more thing that can differ
# between a laptop and a deploy, and transpiling a few thousand lines costs
# hundreds of milliseconds against a container that runs for weeks. If cold
# start ever matters, this is the first thing to change.
FROM node:22-slim

WORKDIR /app

# Dependencies first, so a code change does not re-download node_modules.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# tsx is a devDependency but is what actually runs the server, so it is
# installed on its own rather than pulling in the whole dev tree.
RUN npm install --no-save tsx@4

# Migrations are read from disk at boot, so they have to ship with the image.
COPY src ./src
COPY migrations ./migrations
COPY tsconfig.json ./

# Nothing here needs root.
USER node

ENV NODE_ENV=production
EXPOSE 8787

# Hits the same endpoint a load balancer would, which checks the database
# connection rather than only that the process is alive.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>r.json()).then(b=>process.exit(b.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "tsx", "src/index.ts"]
