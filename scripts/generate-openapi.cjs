require('reflect-metadata');
const { writeFile } = require('node:fs/promises');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');

async function main() {
  process.env.SKIP_DATABASE_CONNECT = 'true';
  const { createApplication } = require('../dist/src/bootstrap');
  const app = await createApplication();
  await app.init();
  const config = new DocumentBuilder()
    .setTitle('API Mundial 2026')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  await writeFile(
    'openapi.json',
    JSON.stringify(SwaggerModule.createDocument(app, config), null, 2),
  );
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
