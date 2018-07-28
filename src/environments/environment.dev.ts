// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `index.ts`, but if you do
// `ng build --env=prod` then `index.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.

export const AppConfig = {
  production: false,
  environment: 'DEV',
  infuraKey: '506w9CbDQR8fULSDR7H0',
  networkId: 'rinkeby',
  tokenMetadata: 'https://token-metadata.airswap.io/rinkebyTokens',
  astProtocolAddress: '0x07fc7c43d8168a2730344e5cf958aaecc3b42b41',
  astAddress: '0xcc1cbd4f67cceb7c001bd4adf98451237a193ff8',
  wethAddress: '0xc778417e063141139fce010982780140aa0cd5ab',
  ethAddress: '0x0000000000000000000000000000000000000000',
  etherscanAddress: 'https://rinkeby.etherscan.io',
};
