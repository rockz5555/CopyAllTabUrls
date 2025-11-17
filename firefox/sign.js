import { signAddon } from 'sign-addon';

signAddon({
  xpiPath: './firefox.zip',
  version: '1.0.1',
  apiKey: 'user:5871784:211',
  apiSecret: '148779b2f672f2be7a180a4fe2c02956afac100117b9fcfcd496b8f4f7390211',
  id: 'info@nizwer.top', // must match manifest
  channel: 'unlisted',
})
  .then((result) => {
    if (result.success) {
      console.log('✅ Signed files:', result.downloadedFiles);
    } else {
      console.error('❌ Signing failed:', result.errorDetails);
    }
  })
  .catch((error) => {
    console.error('🚨 Error:', error);
  });
