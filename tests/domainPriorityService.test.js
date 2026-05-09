import test from "node:test";
import assert from "node:assert/strict";

import {
  reorderGroupsByDomainPriority,
  sanitizeDomainPriorities,
  validateDomainPriority
} from "../src/search-page/services/domainPriorityService.js";

function createGroup(id, count) {
  return {
    id,
    hostname: id,
    title: id,
    count,
    items: Array.from({ length: count }, (_, index) => ({
      title: `${id}-${index}`,
      url: `https://${id}/${index}`
    }))
  };
}

test("validateDomainPriority rejects empty, invalid, and duplicate domains", () => {
  assert.equal(validateDomainPriority("", []).isValid, false);
  assert.equal(validateDomainPriority("foo", []).isValid, false);
  assert.equal(validateDomainPriority("larkoffice.com", ["larkoffice.com"]).isValid, false);

  const validResult = validateDomainPriority(" LarkOffice.com ", []);
  assert.equal(validResult.isValid, true);
  assert.equal(validResult.normalizedDomain, "larkoffice.com");
});

test("sanitizeDomainPriorities keeps only valid unique normalized domains", () => {
  assert.deepEqual(
    sanitizeDomainPriorities([" LarkOffice.com ", "foo", "larkoffice.com", "bytedance.net"]),
    ["larkoffice.com", "bytedance.net"]
  );
});

test("reorderGroupsByDomainPriority promotes configured groups and preserves other order", () => {
  const groups = [
    createGroup("other-results", 5),
    createGroup("larkoffice.com", 4),
    createGroup("bytedance.net", 3),
    createGroup("example.com", 2)
  ];

  const reorderedGroups = reorderGroupsByDomainPriority(groups, ["bytedance.net", "larkoffice.com"]);

  assert.deepEqual(
    reorderedGroups.map((group) => group.id),
    ["bytedance.net", "larkoffice.com", "other-results", "example.com"]
  );
});
