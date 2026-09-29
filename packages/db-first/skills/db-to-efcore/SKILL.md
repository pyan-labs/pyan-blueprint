---
name: db-to-efcore
description: MS SQL DB schema를 읽어 EF Core Entity, DbContext, Fluent API를 생성. "entity 만들어줘", "ef core 모델", "db에서 클래스 뽑아줘" 언급 시 사용.
metadata:
  mcp-server: db-fetcher
---

# DB → EF Core Entity + DbContext 생성

이 스킬은 mcp:db-fetcher를 사용하여 실제 DB 스키마를 읽고, EF Core 코드를 생성합니다.

## Step 0: 현재 프로젝트 확인 (Claude Code / Codex 공통)

- 현재 세션의 작업 디렉토리를 확인하고 절대 경로를 `project_dir`로 사용합니다. 플러그인 설치 디렉토리나 이전에 조회한 다른 프로젝트 경로를 사용하지 않습니다.
- `list_connections`를 포함한 **모든 db-fetcher 도구 호출**에 같은 `project_dir`를 전달합니다. 도구 스키마에서 선택 인자여도 생략하지 않습니다. 예: `list_connections({"project_dir":"C:/Work/ProjectA"})`.
- `config_path`와 `config_scope`를 확인하여 현재 프로젝트 또는 의도한 상위 프로젝트의 `.db-fetcher.json`인지 검증한 뒤 조회합니다. 프로젝트를 바꾸면 새 경로로 `list_connections`부터 다시 시작합니다.
- 경로를 확인할 수 없거나 설정 파일이 없으면 중단하고 사용자에게 확인합니다. 홈의 공용 설정이나 다른 프로젝트 DB로 대체하지 않습니다.

## Step 1: Schema 수집

반드시 아래 순서로 MCP를 호출하여 실제 DB 정보를 수집합니다.

1. `list_connections` → open 환경 확인
2. `get_table_schema` → 대상 테이블의 컬럼, 타입, nullable, PK, identity
3. `get_relationships` → FK 관계, cascade 설정, navigation 방향
4. `get_indexes` → unique constraint, composite index
5. `get_sample_data` (limit: 5) → 실제 데이터 패턴 확인

**절대 스키마를 추측하지 말 것.** 반드시 MCP 호출 결과를 기반으로 생성합니다.

## Step 2: Entity 클래스 생성 규칙

- 테이블명 → PascalCase 단수형 클래스명 (`order_items` → `OrderItem`)
- snake_case 컬럼 → PascalCase 프로퍼티 (`order_date` → `OrderDate`)
- nullable 컬럼 → C# nullable reference type (`string?`, `int?`)
- identity 컬럼 → `[DatabaseGenerated(DatabaseGeneratedOption.Identity)]`
- FK 컬럼 → Navigation property 양방향 구성

```csharp
// 예시 패턴
public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }

    // Navigation
    public Order Order { get; set; } = null!;
}
```

## Step 3: Fluent API Configuration 규칙

- PK, Index는 **반드시 Fluent API**로 설정 (Data Annotation 사용 금지)
- string 길이 제약은 DB의 `max_length` 기반 + 실제 데이터 확인
- 관계 설정: `HasMany`/`WithOne`, `HasOne`/`WithMany` 명시
- cascade delete는 DB의 `on_delete` 설정을 그대로 반영

```csharp
// 예시 패턴
public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("order_items");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.ProductCode).HasMaxLength(50).IsRequired();
        builder.HasOne(e => e.Order)
            .WithMany(o => o.OrderItems)
            .HasForeignKey(e => e.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

## Step 4: DbContext 생성

- 모든 Entity에 대한 `DbSet<T>` 선언
- `OnModelCreating`에서 `ApplyConfigurationsFromAssembly` 사용
- Connection string은 DI로 주입 (하드코딩 금지)

## Step 5: 실제 데이터 기반 검증

`get_sample_data` 결과를 보고:
- `varchar(100)`인데 실제 데이터가 10자 이하 → 주석으로 메모
- 코드성 컬럼 (Y/N, 01/02/03 등) → enum 생성 제안
- null이 한 건도 없는 nullable 컬럼 → 주석으로 "실제로는 항상 값 있음" 메모

## 출력 순서

1. Entity class (각 테이블당 1개)
2. Fluent API Configuration (각 Entity당 1개)
3. DbContext
4. 실제 데이터 기반 메모/제안사항

## Critical

- Code-first migration 생성 금지. DB가 source of truth.
- `get_table_schema` 호출 없이 Entity를 생성하지 말 것.
- 사용자가 명시적으로 요청하지 않은 테이블은 생성하지 말 것.
