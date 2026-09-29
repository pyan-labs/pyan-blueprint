# Claude/Codex Plugin & Marketplace 관리

`db-first` 플러그인은 Claude/Codex에서 각각 설치한다. 이 문서의 명령은 모두 터미널 기준이다. Claude Code 대화창에서는 `claude plugin` 대신 `/plugin`을 사용한다.

## 등록과 설치

Claude Code:

```powershell
claude plugin marketplace add pyan-labs/pyan-blueprint
claude plugin install db-first@pyan-blueprint --scope user
claude plugin list
```

Codex:

```powershell
codex plugin marketplace add pyan-labs/pyan-blueprint
codex plugin add db-first@pyan-blueprint
codex plugin list
```

사용자 전역 설치를 권장한다. 각 프로젝트의 DB 설정은 프로젝트의 `.db-fetcher.json`에 둔다.

## 업데이트

Git 마켓플레이스 목록을 먼저 갱신하고, 플러그인을 갱신한다.

```powershell
# Claude Code
claude plugin marketplace update pyan-blueprint
claude plugin update db-first@pyan-blueprint

# Codex
codex plugin marketplace upgrade pyan-blueprint
codex plugin add db-first@pyan-blueprint
```

갱신 후 새 세션에서 사용한다. Claude Code는 `/reload-plugins`로 다시 로드할 수도 있다. 배포자는 내용 변경 시 플러그인 버전도 올린다. 특히 Claude의 Git 설치는 같은 버전이면 이전 캐시를 유지한다.

로컬 경로로 등록한 Codex 마켓플레이스에는 `marketplace upgrade`를 쓰지 않는다(Git 마켓플레이스용 명령). 로컬 `dist/`를 다시 빌드한 뒤 `plugin add <이름>@pyan-blueprint`로 재설치한다.

## 제거

플러그인을 제거하려면 이름을 지정한다.

```powershell
claude plugin uninstall db-first@pyan-blueprint
codex plugin remove db-first@pyan-blueprint
```

마켓플레이스 이름은 GitHub 주소인 `pyan-labs/pyan-blueprint`가 아니라 `pyan-blueprint`다.

```powershell
claude plugin marketplace remove pyan-blueprint
codex plugin marketplace remove pyan-blueprint
```

Claude Code 2.1.283에서는 마켓플레이스를 제거하면 소속 플러그인도 함께 제거된다. 한 플러그인만 지우려면 `uninstall`을 사용한다. Codex에서는 필요한 플러그인을 먼저 `plugin remove`로 제거한 뒤 마켓플레이스를 제거한다.

## 관리 명령 검증 기준

위 설치·업데이트·제거 절차는 Claude Code 2.1.283 / Codex CLI 0.145.0에서 임시 사용자 설정과 로컬 Git 서버로 검증했다. 실제 사용자 설정은 직접 편집하지 않고 CLI로 관리한다. 버전 갱신과 배포 복구는 [VERSION-BUMP.md](../scripts/VERSION-BUMP.md)를 참조한다.
