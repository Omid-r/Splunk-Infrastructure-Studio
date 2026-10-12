import { ok, requireAuth } from '@/server/http';
import { SPLUNK_VERSIONS, OPERATOR_MATRIX_URL } from '@/server/catalog/splunkVersions';
import { OS_IMAGES, PROVISIONING_CHANNELS } from '@/server/catalog/osImages';

export async function GET() {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  return ok({
    splunk_versions: SPLUNK_VERSIONS,
    operator_matrix_url: OPERATOR_MATRIX_URL,
    os_images: OS_IMAGES,
    provisioning_channels: PROVISIONING_CHANNELS,
  });
}
