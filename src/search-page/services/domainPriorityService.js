const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeDomainPriority(rawDomain) {
  return (rawDomain ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

function isValidDomainLabel(label) {
  return DOMAIN_LABEL_PATTERN.test(label);
}

export function isValidDomainPriority(domain) {
  const normalizedDomain = normalizeDomainPriority(domain);

  if (!normalizedDomain || normalizedDomain.includes("/") || normalizedDomain.includes(":")) {
    return false;
  }

  const labels = normalizedDomain.split(".");

  if (labels.length < 2) {
    return false;
  }

  const topLevelDomain = labels.at(-1) ?? "";

  if (topLevelDomain.length < 2 || !/^[a-z]+$/.test(topLevelDomain)) {
    return false;
  }

  return labels.every(isValidDomainLabel);
}

export function validateDomainPriority(rawDomain, existingDomains = []) {
  const normalizedDomain = normalizeDomainPriority(rawDomain);

  if (!normalizedDomain) {
    return {
      isValid: false,
      normalizedDomain: "",
      message: "请输入域名后再添加。"
    };
  }

  if (!isValidDomainPriority(normalizedDomain)) {
    return {
      isValid: false,
      normalizedDomain,
      message: "请输入合法域名，例如 larkoffice.com。"
    };
  }

  if (existingDomains.includes(normalizedDomain)) {
    return {
      isValid: false,
      normalizedDomain,
      message: "该域名已在优先级列表中。"
    };
  }

  return {
    isValid: true,
    normalizedDomain,
    message: ""
  };
}

export function sanitizeDomainPriorities(domains) {
  if (!Array.isArray(domains)) {
    return [];
  }

  const sanitizedDomains = [];

  for (const domain of domains) {
    const normalizedDomain = normalizeDomainPriority(domain);

    if (!isValidDomainPriority(normalizedDomain) || sanitizedDomains.includes(normalizedDomain)) {
      continue;
    }

    sanitizedDomains.push(normalizedDomain);
  }

  return sanitizedDomains;
}

function getPriorityIndex(group, prioritizedDomains) {
  const groupDomain = normalizeDomainPriority(group?.id || group?.hostname || "");
  return prioritizedDomains.indexOf(groupDomain);
}

export function reorderGroupsByDomainPriority(groups, prioritizedDomains = []) {
  const sanitizedDomains = sanitizeDomainPriorities(prioritizedDomains);

  if (sanitizedDomains.length === 0 || groups.length < 2) {
    return groups;
  }

  return groups
    .map((group, index) => ({
      group,
      index,
      priorityIndex: getPriorityIndex(group, sanitizedDomains)
    }))
    .sort((left, right) => {
      const leftIsPrioritized = left.priorityIndex !== -1;
      const rightIsPrioritized = right.priorityIndex !== -1;

      if (leftIsPrioritized && rightIsPrioritized) {
        return left.priorityIndex - right.priorityIndex;
      }

      if (leftIsPrioritized) {
        return -1;
      }

      if (rightIsPrioritized) {
        return 1;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.group);
}
