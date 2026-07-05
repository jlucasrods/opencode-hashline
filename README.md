# opencode-hashline

Este projeto resolve um problema chato do OpenCode: edições de arquivo ficam frágeis quando o LLM só tem texto bruto, números de linha e precisa reconstruir manualmente o trecho que quer alterar.

O `edit` original do OpenCode normalmente funciona como uma substituição de texto: o modelo informa o arquivo, o conteúdo antigo que deve ser encontrado e o conteúdo novo que deve entrar no lugar. Na prática, isso parece um diff pequeno. Funciona bem quando o trecho é único e o modelo lembra o texto exatamente, mas fica frágil quando há blocos parecidos, mudanças recentes no arquivo, espaços diferentes ou contexto desatualizado. O problema não é apenas indicar a linha certa; o LLM precisa escrever corretamente o texto que quer substituir.

O Hashline melhora esse fluxo adicionando refs estáveis nas leituras, como `#HL 6#14C#E2A`. Em vez de depender só da memória textual do modelo, a edição aponta para um ref produzido pelo `read`, informa a operação desejada e usa um token opcional de revisão do arquivo. O plugin valida se o arquivo ainda está no estado esperado, resolve o ref para a linha correta e só então aplica a mutação.

Na prática, isso significa:

- menos edições na linha errada;
- contexto desatualizado é detectado em vez de aplicado silenciosamente;
- o modelo continua usando o fluxo normal de tools e UI do OpenCode, mas com uma referência mais segura para editar.

## Instalação local

Clone o repositório dentro da pasta global de plugins e crie um loader direto em `~/.config/opencode/plugins`:

```bash
git clone git@github.com:jlucasrods/opencode-hashline.git ~/.config/opencode/plugins/opencode-hashline
cd ~/.config/opencode/plugins/opencode-hashline
npm ci
npm run build
cat > ~/.config/opencode/plugins/hashline.js <<'EOF'
export { default } from "./opencode-hashline/dist/src/index.js"
EOF
```

Reinicie o OpenCode depois disso. Não é necessário mexer no `~/.config/opencode/opencode.json`: o OpenCode carrega automaticamente arquivos `.js` diretos em `~/.config/opencode/plugins`.

## Atualização

Para sincronizar uma instalação global já existente com a versão mais recente do repositório:

```bash
cd ~/.config/opencode/plugins/opencode-hashline
git pull --ff-only
npm ci
npm run build
```

Depois reinicie o OpenCode para recarregar o plugin compilado.

## Configuração

Opcionalmente, crie um arquivo `opencode-hashline.json` no global do OpenCode ou na raiz do projeto:

- global: `~/.config/opencode/opencode-hashline.json`
- projeto: `<project>/opencode-hashline.json`

Exemplo:

```json
{
  "exclude": ["**/node_modules/**"],
  "maxFileSize": 1048576,
  "cacheSize": 100,
  "prefix": "#HL",
  "fileRev": true,
  "safeReapply": false
}
```

Chaves suportadas:

- `exclude`: globs que não devem ser anotados.
- `maxFileSize`: tamanho máximo da saída anotada em bytes; `0` desativa o limite.
- `cacheSize`: quantidade de entradas no cache de anotações.
- `safeReapply`: tenta reencontrar uma linha movida quando o hash é único.
- `prefix`: usado em helpers e ao remover prefixos de conteúdo, mas o `read` principal usa refs canônicos `#HL`.
- `fileRev`: usado em helpers/formatadores, mas o `read` principal emite `REV` canônico.

## Uso

Leia um arquivo normalmente com `read`. A saída vem anotada com refs:

```text
#HL REV:4B58D3E2
#HL 6#14C#E2A|Texto atual da linha
```

Edite usando `apply_patch_hashline`:

```json
{
  "filePath": "/caminho/do/arquivo.md",
  "operation": "replace",
  "startRef": "#HL 6#14C#E2A",
  "replacement": "Novo texto da linha",
  "fileRev": "4B58D3E2"
}
```

Operações suportadas:

- `replace`
- `delete`
- `insert_before`
- `insert_after`
- `replace_range`

Também é possível enviar `operations` para aplicar várias mudanças no mesmo arquivo em uma chamada.
