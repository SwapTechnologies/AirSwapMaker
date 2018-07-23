// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `index.ts`, but if you do
// `ng build --env=prod` then `index.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.

export const AppConfig = {
  production: false,
  environment: 'DEV',
  networkId: 'mainnet',
  tokenMetadata: 'https://token-metadata.airswap.io/tokens',
  astAddress: '0x27054b13b1b798b345b591a4d22e6562d47ea75a',
  wethAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  ethAddress: '0x0000000000000000000000000000000000000000',
};
