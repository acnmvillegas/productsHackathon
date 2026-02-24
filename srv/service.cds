using shellLifeAnalyzer.db as db from '../db/schema';

service ShelfLifeService {
    @odata.draft.enabled
    entity MaterialShelfLife as projection on db.MaterialShelfLife;
}