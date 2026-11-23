import { Tag, Tooltip } from 'antd';
import { formatUsd } from '../lib/format';
import type { Band, BandPosition } from '../api/types';

const PRESENTATION: Record<BandPosition, { color: string; label: string }> = {
  BELOW_BAND: { color: 'red', label: 'Below band' },
  LOWER_HALF: { color: 'blue', label: 'Lower half' },
  UPPER_HALF: { color: 'green', label: 'Upper half' },
  ABOVE_BAND: { color: 'orange', label: 'Above band' },
};

/** Shows where someone sits in their band, with the band itself one hover away. */
export function BandPositionTag({
  position,
  band,
  compaRatio,
}: {
  position: BandPosition;
  band: Band;
  compaRatio: number;
}) {
  const { color, label } = PRESENTATION[position];
  return (
    <Tooltip
      title={`Band ${formatUsd(band.minUsd)} – ${formatUsd(band.maxUsd)} (midpoint ${formatUsd(
        band.midUsd,
      )}). Compa-ratio ${compaRatio.toFixed(2)}.`}
    >
      <Tag color={color}>{label}</Tag>
    </Tooltip>
  );
}
