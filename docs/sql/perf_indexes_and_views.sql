-- 인덱스 및 평점 요약 뷰

-- 1) 기본 인덱스들 (존재 시 무시)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ai_services_name' AND object_id = OBJECT_ID('dbo.ai_services'))
  CREATE INDEX IX_ai_services_name ON dbo.ai_services(name);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ai_services_domain' AND object_id = OBJECT_ID('dbo.ai_services'))
  CREATE INDEX IX_ai_services_domain ON dbo.ai_services(domain);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_pricing_service_type' AND object_id = OBJECT_ID('dbo.ai_service_pricing'))
  CREATE INDEX IX_pricing_service_type ON dbo.ai_service_pricing(service_id, pricing_type);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tags_service_tag' AND object_id = OBJECT_ID('dbo.ai_service_tags'))
  CREATE INDEX IX_tags_service_tag ON dbo.ai_service_tags(service_id, tag);

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.ai_service_login_methods') AND type = 'U')
BEGIN
  DECLARE @loginCol sysname = (
    SELECT TOP 1 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ai_service_login_methods')
    AND name IN ('login_type','method','login_method','type','name')
  );
  IF @loginCol IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_login_service_type' AND object_id = OBJECT_ID('dbo.ai_service_login_methods'))
  BEGIN
    DECLARE @sql nvarchar(max) = N'CREATE INDEX IX_login_service_type ON dbo.ai_service_login_methods(service_id, [' + @loginCol + N'])';
    EXEC(@sql);
  END
END

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.ai_reviews') AND type = 'U')
BEGIN
  DECLARE @fkCol sysname = (
    SELECT TOP 1 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ai_reviews')
    AND name IN ('service_id','tool_id','ai_service_id','service','target_service_id')
  );
  IF @fkCol IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_reviews_service' AND object_id = OBJECT_ID('dbo.ai_reviews'))
  BEGIN
    DECLARE @sql2 nvarchar(max) = N'CREATE INDEX IX_reviews_service ON dbo.ai_reviews([' + @fkCol + N'])';
    EXEC(@sql2);
  END
END

-- 2) 평점 요약 뷰
IF OBJECT_ID('dbo.vw_service_rating_summary','V') IS NOT NULL
  DROP VIEW dbo.vw_service_rating_summary;
GO
CREATE VIEW dbo.vw_service_rating_summary AS
SELECT 
  COALESCE(r.service_id, r.tool_id, r.ai_service_id, r.target_service_id) AS service_id,
  AVG(CAST(COALESCE(r.score, r.rating, r.stars, r.star, r.value, r.rate) AS FLOAT)) AS avg_rating,
  COUNT(*) AS review_count
FROM dbo.ai_reviews r WITH (NOLOCK)
GROUP BY COALESCE(r.service_id, r.tool_id, r.ai_service_id, r.target_service_id);
GO






