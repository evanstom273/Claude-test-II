import type { ZoneId } from '../../state/types';
import { HOLLOWDEEP } from './hollowdeep';
import { RIFT } from './rift';
import { SALTMERE } from './saltmere';
import type { MapDef } from './types';
import { VILLAGE } from './village';
import { WHISPERWOOD } from './whisperwood';

export const MAPS: Record<ZoneId, MapDef> = {
  village: VILLAGE,
  whisperwood: WHISPERWOOD,
  hollowdeep: HOLLOWDEEP,
  saltmere: SALTMERE,
  rift: RIFT,
};
