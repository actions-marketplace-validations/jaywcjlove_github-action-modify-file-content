import FS from 'fs-extra';
import path from 'path';
import { context, getOctokit } from '@actions/github';
import { getInput, setFailed, startGroup, info, endGroup,  } from '@actions/core';
import { paths, components,  } from '@octokit/openapi-types';
import { OctokitResponse } from '@octokit/types';

type Query = paths['/issues']['get']['parameters']['query'];
export type FilePutQuery = paths['/repos/{owner}/{repo}/contents/{path}']['put']['requestBody']['content']['application/json'] & paths['/repos/{owner}/{repo}/contents/{path}']['put']['parameters']['path'];

export const myToken = getInput('token');
export const octokit = getOctokit(myToken);

export const getInputs = () => {
  const body = getInput('body') || '';
  const filepath = getInput('path') || '';
  const openDelimiter = getInput('openDelimiter') || '<!--GAMFC-->';
  const closeDelimiter = getInput('closeDelimiter') || '<!--GAMFC-END-->';
  return {
    ...context.repo,
    body, filepath,
    openDelimiter,
    closeDelimiter
  }
}

export async function getReposPathContents(filePath: string) {
  const {owner, repo} = getInputs()
  const result = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
    owner, repo,
    path: filePath,
    // ref: ''
  });
  return result
}

export async function modifyPathContents(options: Partial<FilePutQuery> = {}, content: string) {
  const { ...other} = options;
  const {owner, repo, openDelimiter, closeDelimiter } = getInputs();
  if (!options.path) {
    throw new Error(`modifyPathContents: file directory parameter does not exist`)
  }
  const fullPath = path.resolve(options.path);
  const isExists = FS.existsSync(fullPath)
  info(`👉 Modify Path (${options.path})`)
  const body: FilePutQuery = {
    owner, repo,
    path: options.path,
    message: `doc: ${options.sha ? 'modify' : 'create'} ${options.path}.`,
    committer: {
      name: 'github-actions[bot]',
      email: 'github-actions[bot]@users.noreply.github.com'
    },
    ...other,
    content: Buffer.from(content).toString("base64"),
  }
  if (isExists) {
    const fileResult = await getReposPathContents(options.path)
    if (fileResult.status === 200 && (fileResult.data as any).sha) {
      body.sha = (fileResult.data as any).sha;
      let fileContent: string = (fileResult.data as any).content || '';
      let reuslt = fileContent.replace(new RegExp(`${openDelimiter}(.*?)${closeDelimiter}`, 'ig'), `${openDelimiter}${content}${closeDelimiter}`);
      info(`👉 Text Content: ${reuslt}`)
      body.content = reuslt;
    }
  }
  startGroup(`modifyPathContents Body:`)
    info(`👉 ${JSON.stringify(body, null, 2)}`)
  endGroup()
  return octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
    ...body,
  });
}

export type IssuesData = components["schemas"]["issue"][];
export type Response = OctokitResponse<IssuesData, 200>
