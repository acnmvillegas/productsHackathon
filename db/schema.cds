namespace shellLifeAnalyzer.db;

entity MaterialShelfLife {
  key MATNR            : String(40)    @title: 'Material Number';
  key WERKS            : String(4)     @title: 'Plant';
  key CHARG            : String(10)    @title: 'Batch';

      XCHPF            : String(1)     @title: 'Batch Managed';
      IPRKZ            : String(1)     @title: 'Period Indicator';
      MHDRZ            : Decimal(4, 0) @title: 'Minimum Remaining Shelf Life';
      VFDAT            : Date          @title: 'Shelf Life Expiration / BBD';
      HSDAT            : Date          @title: 'Date of Manufacture';
      TOTAL_SHELF_LIFE : Integer       @title: 'Total Shelf Life';

  @cds.persistence.skip
  RemainingDays        : Integer       @title: 'Remaining Shelf Life (Days)';

  @cds.persistence.skip
  Status               : String(10)     @title: 'Status'; // Green | Yellow | Red

  @cds.persistence.skip
  Criticality          : Integer       @title: 'Criticality'; // 3=Green,2=Yellow,1=Red

}