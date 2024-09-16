import React, { useState, ChangeEvent, FormEvent } from 'react';

interface FormData {
  sex: string;
  age: string;
  shoppingFrequency: string;
  interests: string[];
  shoppingCategories: string[];
}

const ProfilePage: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    sex: '',
    age: '',
    shoppingFrequency: '',
    interests: [],
    shoppingCategories: []
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked 
          ? [...prev[name as keyof FormData] as string[], value]
          : (prev[name as keyof FormData] as string[]).filter(item => item !== value)
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(formData);
    // Here you would typically send the data to your backend
  };

  const buttonStyle = "px-4 py-2 bg-gray-800 text-white rounded-full mr-2 mb-2 text-sm focus:outline-none";
  const selectedButtonStyle = "px-4 py-2 bg-orange-500 text-white rounded-full mr-2 mb-2 text-sm focus:outline-none";
  const checkboxStyle = "form-checkbox h-5 w-5 text-orange-500 rounded-sm bg-gray-800 border-gray-600 focus:ring-0 focus:ring-offset-0";

  return (
    <div className="bg-black text-white p-4 min-h-screen max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-1">Profile</h1>
      <p className="mb-4 text-sm text-gray-400">Complete your profile and earn rewards</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="mb-2 text-sm">Sex</p>
          <div className="flex">
            {['Female', 'Male'].map((sex) => (
              <button
                key={sex}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, sex }))}
                className={formData.sex === sex ? selectedButtonStyle : buttonStyle}
              >
                {sex}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm">Age</p>
          <div className="flex flex-wrap">
            {['18-18', '19-24', '24-30', '31-40', '41-50', '51+'].map((age) => (
              <button
                key={age}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, age }))}
                className={formData.age === age ? selectedButtonStyle : buttonStyle}
              >
                {age}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm">How Frequent do You shop Online</p>
          <div className="flex flex-wrap">
            {['Never', 'Daily', 'Weekly', 'Monthly'].map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, shoppingFrequency: freq }))}
                className={formData.shoppingFrequency === freq ? selectedButtonStyle : buttonStyle}
              >
                {freq}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm">Interest</p>
          <div className="grid grid-cols-3 gap-2">
            {['Tech', 'Cars', 'Cooking', 'Fashion', 'Games', 'Art', 'Movies', 'Sports', 'Music', 'Photography', 'Food', 'Travel'].map((interest) => (
              <label key={interest} className="flex items-center">
                <input
                  type="checkbox"
                  name="interests"
                  value={interest}
                  checked={formData.interests.includes(interest)}
                  onChange={handleChange}
                  className={checkboxStyle}
                />
                <span className="ml-2 text-sm">{interest}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm">Shopping</p>
          <div className="grid grid-cols-2 gap-2">
            {['Electronics', 'Gaming', 'Movies', 'Sporting Gear', 'Phones & Tablets', 'Appliance'].map((category) => (
              <label key={category} className="flex items-center">
                <input
                  type="checkbox"
                  name="shoppingCategories"
                  value={category}
                  checked={formData.shoppingCategories.includes(category)}
                  onChange={handleChange}
                  className={checkboxStyle}
                />
                <span className="ml-2 text-sm">{category}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-orange-500 text-white py-3 rounded-full text-sm font-semibold focus:outline-none"
        >
          Save
        </button>
      </form>
    </div>
  );
};

export default ProfilePage;
