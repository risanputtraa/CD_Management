# Application version

The sidebar reads app-version.json through /api/bootstrap.

For every completed user-requested change, increment the numeric build by one, preserving four-digit padding (0001, 0002, ...). Include app-version.json in the deployment. Do not calculate the build from file hashes or change it at server startup. Local and deployed copies of the same release must carry the same file. Restart the server after changing this file.
