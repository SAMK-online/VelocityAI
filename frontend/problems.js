// LeetCode Problems Database
const PROBLEMS = {
  'two-sum': {
    id: 1,
    title: 'Two Sum',
    difficulty: 'Easy',
    tags: ['Array', 'Hash Map'],
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.`,
    constraints: [
      '2 <= nums.length <= 10⁴',
      '-10⁹ <= nums[i] <= 10⁹',
      '-10⁹ <= target <= 10⁹',
      'Only one valid answer exists.'
    ],
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0,1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].'
      },
      {
        input: 'nums = [3,2,4], target = 6',
        output: '[1,2]',
        explanation: ''
      },
      {
        input: 'nums = [3,3], target = 6',
        output: '[0,1]',
        explanation: ''
      }
    ],
    starterCode: {
      python: `def two_sum(nums, target):
    # Your code here
    pass

# Test
print(two_sum([2,7,11,15], 9))  # Expected: [0,1]`,
      javascript: `function twoSum(nums, target) {
    // Your code here
}

// Test
console.log(twoSum([2,7,11,15], 9));  // Expected: [0,1]`,
      typescript: `function twoSum(nums: number[], target: number): number[] {
    // Your code here
    return [];
}

// Test
console.log(twoSum([2,7,11,15], 9));  // Expected: [0,1]`
    },
    testCases: [
      { input: '[2,7,11,15]\n9', expected: '[0, 1]' },
      { input: '[3,2,4]\n6', expected: '[1, 2]' },
      { input: '[3,3]\n6', expected: '[0, 1]' }
    ],
    solutionVideo: {
      title: 'Two Sum - Leetcode 1 - HashMap - Python',
      videoId: 'KLlXCFG5TnA',
      channel: 'NeetCode',
      duration: '8:23'
    }
  },
  'valid-parentheses': {
    id: 20,
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    tags: ['Stack', 'String'],
    description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
- Open brackets must be closed by the same type of brackets.
- Open brackets must be closed in the correct order.
- Every close bracket has a corresponding open bracket of the same type.`,
    constraints: [
      '1 <= s.length <= 10⁴',
      's consists of parentheses only \'()[]{}\'.'
    ],
    examples: [
      {
        input: 's = "()"',
        output: 'true',
        explanation: ''
      },
      {
        input: 's = "()[]{}"',
        output: 'true',
        explanation: ''
      },
      {
        input: 's = "(]"',
        output: 'false',
        explanation: ''
      }
    ],
    starterCode: {
      python: `def is_valid(s):
    # Your code here
    pass

# Test
print(is_valid("()"))  # Expected: True`,
    },
    testCases: [
      { input: '()', expected: 'True' },
      { input: '()[]{}', expected: 'True' },
      { input: '(]', expected: 'False' }
    ],
    solutionVideo: {
      title: 'Valid Parentheses - Stack - Leetcode 20 - Python',
      videoId: 'WTzjTskDFMg',
      channel: 'NeetCode',
      duration: '6:37'
    }
  },
  'reverse-linked-list': {
    id: 206,
    title: 'Reverse Linked List',
    difficulty: 'Easy',
    tags: ['Linked List'],
    description: `Given the head of a singly linked list, reverse the list, and return the reversed list.`,
    constraints: [
      'The number of nodes in the list is the range [0, 5000].',
      '-5000 <= Node.val <= 5000'
    ],
    examples: [
      {
        input: 'head = [1,2,3,4,5]',
        output: '[5,4,3,2,1]',
        explanation: ''
      },
      {
        input: 'head = [1,2]',
        output: '[2,1]',
        explanation: ''
      },
      {
        input: 'head = []',
        output: '[]',
        explanation: ''
      }
    ],
    starterCode: {
      python: `# Definition for singly-linked list.
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def reverse_list(head):
    # Your code here
    pass`,
    },
    testCases: [],
    solutionVideo: {
      title: 'Reverse Linked List - Leetcode 206 - Python',
      videoId: 'G0_I-ZF0S38',
      channel: 'NeetCode',
      duration: '7:17'
    }
  },
  'best-time-to-buy-sell-stock': {
    id: 121,
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'Easy',
    tags: ['Array', 'Dynamic Programming'],
    description: `You are given an array prices where prices[i] is the price of a given stock on the ith day.

You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock.

Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return 0.`,
    constraints: [
      '1 <= prices.length <= 10⁵',
      '0 <= prices[i] <= 10⁴'
    ],
    examples: [
      {
        input: 'prices = [7,1,5,3,6,4]',
        output: '5',
        explanation: 'Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6-1 = 5.'
      },
      {
        input: 'prices = [7,6,4,3,1]',
        output: '0',
        explanation: 'No profit can be made.'
      }
    ],
    starterCode: {
      python: `def max_profit(prices):
    # Your code here
    pass

# Test
print(max_profit([7,1,5,3,6,4]))  # Expected: 5`
    },
    testCases: [],
    solutionVideo: {
      title: 'Best Time to Buy and Sell Stock - Leetcode 121 - Python',
      videoId: '1pkOgXD63yU',
      channel: 'NeetCode',
      duration: '9:43'
    }
  },
  'contains-duplicate': {
    id: 217,
    title: 'Contains Duplicate',
    difficulty: 'Easy',
    tags: ['Array', 'Hash Table'],
    description: `Given an integer array nums, return true if any value appears at least twice in the array, and return false if every element is distinct.`,
    constraints: [
      '1 <= nums.length <= 10⁵',
      '-10⁹ <= nums[i] <= 10⁹'
    ],
    examples: [
      {
        input: 'nums = [1,2,3,1]',
        output: 'true',
        explanation: ''
      },
      {
        input: 'nums = [1,2,3,4]',
        output: 'false',
        explanation: ''
      }
    ],
    starterCode: {
      python: `def contains_duplicate(nums):
    # Your code here
    pass

# Test
print(contains_duplicate([1,2,3,1]))  # Expected: True`
    },
    testCases: [],
    solutionVideo: {
      title: 'Contains Duplicate - Leetcode 217 - Python',
      videoId: '3OamzN90kPg',
      channel: 'NeetCode',
      duration: '4:21'
    }
  },
  'maximum-subarray': {
    id: 53,
    title: 'Maximum Subarray',
    difficulty: 'Medium',
    tags: ['Array', 'Dynamic Programming', 'Divide and Conquer'],
    description: `Given an integer array nums, find the subarray with the largest sum, and return its sum.`,
    constraints: [
      '1 <= nums.length <= 10⁵',
      '-10⁴ <= nums[i] <= 10⁴'
    ],
    examples: [
      {
        input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]',
        output: '6',
        explanation: 'The subarray [4,-1,2,1] has the largest sum 6.'
      },
      {
        input: 'nums = [1]',
        output: '1',
        explanation: ''
      }
    ],
    starterCode: {
      python: `def max_subarray(nums):
    # Your code here
    pass

# Test
print(max_subarray([-2,1,-3,4,-1,2,1,-5,4]))  # Expected: 6`
    },
    testCases: [],
    solutionVideo: {
      title: 'Maximum Subarray - Kadanes Algorithm - Leetcode 53 - Python',
      videoId: '5WZl3MMT0Eg',
      channel: 'NeetCode',
      duration: '11:33'
    }
  },
  'product-of-array-except-self': {
    id: 238,
    title: 'Product of Array Except Self',
    difficulty: 'Medium',
    tags: ['Array', 'Prefix Sum'],
    description: `Given an integer array nums, return an array answer such that answer[i] is equal to the product of all the elements of nums except nums[i].

You must write an algorithm that runs in O(n) time and without using the division operation.`,
    constraints: [
      '2 <= nums.length <= 10⁵',
      '-30 <= nums[i] <= 30'
    ],
    examples: [
      {
        input: 'nums = [1,2,3,4]',
        output: '[24,12,8,6]',
        explanation: ''
      },
      {
        input: 'nums = [-1,1,0,-3,3]',
        output: '[0,0,9,0,0]',
        explanation: ''
      }
    ],
    starterCode: {
      python: `def product_except_self(nums):
    # Your code here
    pass

# Test
print(product_except_self([1,2,3,4]))  # Expected: [24,12,8,6]`
    },
    testCases: [],
    solutionVideo: {
      title: 'Product of Array Except Self - Leetcode 238 - Python',
      videoId: 'bNvIQI2wAjk',
      channel: 'NeetCode',
      duration: '9:54'
    }
  },
  '3sum': {
    id: 15,
    title: '3Sum',
    difficulty: 'Medium',
    tags: ['Array', 'Two Pointers', 'Sorting'],
    description: `Given an integer array nums, return all the triplets [nums[i], nums[j], nums[k]] such that i != j, i != k, and j != k, and nums[i] + nums[j] + nums[k] == 0.

Notice that the solution set must not contain duplicate triplets.`,
    constraints: [
      '3 <= nums.length <= 3000',
      '-10⁵ <= nums[i] <= 10⁵'
    ],
    examples: [
      {
        input: 'nums = [-1,0,1,2,-1,-4]',
        output: '[[-1,-1,2],[-1,0,1]]',
        explanation: ''
      },
      {
        input: 'nums = [0,1,1]',
        output: '[]',
        explanation: ''
      }
    ],
    starterCode: {
      python: `def three_sum(nums):
    # Your code here
    pass

# Test
print(three_sum([-1,0,1,2,-1,-4]))  # Expected: [[-1,-1,2],[-1,0,1]]`
    },
    testCases: [],
    solutionVideo: {
      title: '3Sum - Leetcode 15 - Python',
      videoId: 'jzZsG8n2R9A',
      channel: 'NeetCode',
      duration: '12:06'
    }
  }
};
