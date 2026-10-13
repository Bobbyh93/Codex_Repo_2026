#!/usr/bin/env node
const fs = require("fs-extra");
const args = require('args')

args.option('name', 'Name of the package').option('template', 'Template from templates folder', "default");

const flags = args.parse(process.argv)

if (!flags.name) {
    throw new Error("No flag name provided");
}

(async () => {
    await fs.copy(`./templates/${flags.template}`, `./packages/${flags.name}`);

    const data = await fs.readFile(`./packages/${flags.name}/package.json`, 'utf8');

    const result = data.replace(/{{package-name}}/g, flags.name);

    await fs.writeFile(`./packages/${flags.name}/package.json`, result, 'utf8');
})()


