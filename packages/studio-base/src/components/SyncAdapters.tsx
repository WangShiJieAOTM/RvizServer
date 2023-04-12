// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { URLStateSyncAdapter } from "@foxglove/studio-base/components/URLStateSyncAdapter";
import { useAppContext } from "@foxglove/studio-base/context/AppContext";
import { IdbLayoutSaver } from "@foxglove/studio-base/providers/CurrentLayoutProvider/IdbLayoutSaver";

export function SyncAdapters(): JSX.Element {
  const { syncAdapters = [<IdbLayoutSaver key="core-idb" />] } = useAppContext();

  return (
    <>
      {...syncAdapters}
      <URLStateSyncAdapter />
    </>
  );
}
