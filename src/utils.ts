import FS from 'fs-extra';
import path from 'path';
import { context, getOctokit } from '@actions/github';
import { getInput, setOutput, startGroup, info, endGroup,  } from '@actions/core';
import { paths, components,  } from '@octokit/openapi-types';
import { OctokitResponse } from '@octokit/types';

export type FilePutQuery = paths['/repos/{owner}/{repo}/contents/{path}']['put']['requestBody']['content']['application/json'] & paths['/repos/{owner}/{repo}/contents/{path}']['put']['parameters']['path'];

export const myToken = getInput('token');
export const octokit = getOctokit(myToken);

export const getInputs = () => {
  const body = getInput('body') || '';
  const overwrite = getInput('overwrite') || 'false';
  const sync_local_file = getInput('sync_local_file') || 'true';
  const filepath = getInput('path') || '';
  const message = getInput('message') || '';
  const committer_name = getInput('committer_name') || '';
  const committer_email = getInput('committer_email') || '';
  const openDelimiter = getInput('openDelimiter') || '<!--GAMFC-->';
  const closeDelimiter = getInput('closeDelimiter') || '<!--GAMFC-END-->';
  return {
    ...context.repo,
    body, filepath,
    message,
    committer_name,
    committer_email,
    openDelimiter,
    closeDelimiter,
    overwrite,
    sync_local_file
  }
}

export async function getReposPathContents(filePath: string) {
  const {owner, repo} = getInputs()
  const result = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
    owner, repo,
    path: filePath,
  });
  return result
}

export async function modifyPathContents(options: Partial<FilePutQuery> = {}, content: string) {
  const { ...other} = options;
  const {owner, repo, openDelimiter, closeDelimiter, message, committer_name, committer_email, overwrite, sync_local_file} = getInputs();
  if (!options.path) {
    throw new Error(`modifyPathContents: file directory parameter does not exist`)
  }
  const fullPath = path.resolve(options.path);
  const isExists = FS.existsSync(fullPath)
  info(`👉 Modify Path (${options.path})`)
  const body: FilePutQuery = {
    owner, repo,
    path: options.path,
    message: message || `doc: ${isExists ? 'modify' : 'create'} ${options.path}.`,
    committer: {
      name: committer_name || 'github-actions[bot]',
      email: committer_email || 'github-actions[bot]@users.noreply.github.com'
    },
    ...other,
    content: Buffer.from(content).toString("base64"),
  }
  if (isExists) {
    const fileResult = await getReposPathContents(options.path)
    if (fileResult.status === 200 && (fileResult.data as any).sha) {
      body.sha = (fileResult.data as any).sha;
      let fileContent: string = (fileResult.data as any).content || '';
      let reuslt = Buffer.from(fileContent, 'base64').toString().replace(new RegExp(`${openDelimiter}(.*?)${closeDelimiter}`, 'ig'), `${openDelimiter}${content}${closeDelimiter}`);
      startGroup(`👉 Text Content:`)
        info(`👉 ${JSON.stringify(fileResult.data, null, 2)}`)
        info(`👉 ${reuslt}`)
      endGroup()
      setOutput('content', reuslt)
      let new_content = Buffer.from(content).toString("base64")
      if (overwrite.toString() === 'true') {
        body.content = new_content;
      } else {
        body.content = Buffer.from(reuslt).toString("base64");
        new_content = reuslt;
      }
      if (sync_local_file.toString() === 'true') {
        await FS.writeFile(fullPath, new_content);
      }
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
