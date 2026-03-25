import { RoomCompositeEgressRequest, EncodedFileOutput, S3Upload } from '@livekit/protocol';

const sessionId = "test-session";
const roomName = "session-test";
const bucket = "test-bucket";
const accessKeyId = "test-key";
const secretAccessKey = "test-secret";
const accountId = "test-account";

const s3Config = {
    bucket,
    accessKey: accessKeyId,
    secret: secretAccessKey,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    forcePathStyle: true,
};

// THE NEW STRUCTURE
const encodedFileOutput = {
  filepath: `recordings/${sessionId}.mp4`,
  fileType: 1,
  output: {
    case: "s3",
    value: s3Config
  }
};

const req = new RoomCompositeEgressRequest({
  roomName,
  output: {
    case: "file",
    value: encodedFileOutput
  } as any
});

console.log("JSON Output (Double Wrapped):");
console.log(JSON.stringify(req.toJson(), null, 2));

// Also testing if the SDK can handle this if we pass it to startRoomCompositeEgress
// If we pass 'encodedFileOutput' directly to the SDK, it will try to map it.
// SDK's isEncodedFileOutput checks for .filepath. It will find it.
// Then it sets legacyOutput = { case: 'file', value: encodedFileOutput }.
// This SHOULD work!
