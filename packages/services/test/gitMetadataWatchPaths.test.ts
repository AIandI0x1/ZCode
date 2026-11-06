// Git 元数据监视边界回归测试（见 gitCliRepo.ts buildGitMetadataWatchPaths 注释）。
//
// 背景：Linux 的 `fs.watch(dir, { recursive: true })` 为目录树里的每个文件/目录各注册
// 一个 inotify watch，注册成本是 O(条目数)。递归监视整个 `.git` 会让松散对象多的仓库
// 阻塞 Host 事件循环数十秒，把 renderer 的 `session/requestRuntimePreferences` 拖过
// 15 秒客户端超时，用户回合直接失败（"Client request timed out"）。
import { describe, expect, it } from "vitest";
import {
  GIT_METADATA_RECURSIVE_WATCH_SUBDIRS,
  buildGitMetadataWatchPaths,
} from "../src/git/repo/gitCliRepo.js";

describe("buildGitMetadataWatchPaths", () => {
  it("git 目录本身只做非递归监视", () => {
    const paths = buildGitMetadataWatchPaths("/repo/.git");

    // 回归保护：一旦这里变回 recursive: true，松散对象多的仓库会再次阻塞 Host。
    expect(paths.find((entry) => entry.path === "/repo/.git")).toEqual({
      path: "/repo/.git",
      recursive: false,
    });
  });

  it("只递归引用类子目录，object/lfs/modules 存储不进监视集", () => {
    const recursivePaths = buildGitMetadataWatchPaths("/repo/.git")
      .filter((entry) => entry.recursive)
      .map((entry) => entry.path)
      .sort();

    expect(recursivePaths).toEqual(
      GIT_METADATA_RECURSIVE_WATCH_SUBDIRS.map((subdirectory) => `/repo/.git/${subdirectory}`).sort(),
    );

    for (const forbidden of ["/objects", "/lfs", "/modules"]) {
      expect(recursivePaths.some((path) => path.endsWith(forbidden))).toBe(false);
    }
  });

  it("归一化末尾斜杠，且不产生重复监视项", () => {
    const paths = buildGitMetadataWatchPaths("/repo/.git/");

    expect(paths[0]).toEqual({ path: "/repo/.git", recursive: false });

    const watchedPaths = paths.map((entry) => entry.path);
    expect(new Set(watchedPaths).size).toBe(watchedPaths.length);
  });
});
