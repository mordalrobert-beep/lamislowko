# Łamisłówko - aplikacja web na GitHub

To jest statyczna aplikacja internetowa gotowa do publikacji na **GitHub Pages**.

## Szybki start

1. Utwórz nowe repozytorium na GitHub.
2. Skopiuj ten katalog do repozytorium.
3. Wykonaj:

```bash
git init
git add .
git commit -m "Init web app"
git branch -M main
git remote add origin https://github.com/TWOJ_LOGIN/TWOJE_REPO.git
git push -u origin main
```

4. Wejdź w repo na GitHub:
   - `Settings` -> `Pages` -> `Build and deployment`
   - `Source`: wybierz **GitHub Actions**
5. Po pushu na `main` workflow sam opublikuje stronę.

## URL aplikacji

- Dla repozytorium projektowego:
  `https://TWOJ_LOGIN.github.io/TWOJE_REPO/`
- Dla repozytorium `TWOJ_LOGIN.github.io`:
  `https://TWOJ_LOGIN.github.io/`

## Co jest wdrażane

Workflow publikuje pliki:
- `index.html`
- `styles.css`
- `script.js`
- `normal_words.js`
- `foreign-dictionary-data.js`
- `kurczaczek.ico`
- `dictionary/pl_PL.words.js`
- `dictionary/pl_PL.dic`
